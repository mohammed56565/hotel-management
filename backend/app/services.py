"""Transactional hotel operations. Every write locks the singleton hotel row first.

PostgreSQL READ COMMITTED + this common lock serializes capacity and state checks
across workers. Keep the lock through commit, including inventory configuration.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import func, select
from .config import settings
from .models import GuestProfile, HotelSettings, HousekeepingTask, Reservation, Room, RoomType, utcnow

ACTIVE = ('Confirmed', 'Checked In')


def now_local():
    return datetime.now(ZoneInfo(settings.hotel_timezone))


def fail(message, code=409):
    raise HTTPException(code, message)


def get_or_404(db, model, identity):
    obj = db.get(model, identity)
    if obj is None:
        fail('Record not found.', 404)
    return obj


def lock_hotel(db):
    hotel = db.scalar(select(HotelSettings).where(HotelSettings.id == 1).with_for_update().execution_options(populate_existing=True))
    if not hotel:
        fail('Hotel setup is incomplete. Run the database migrations.', 503)
    return hotel


def ready(room):
    return room.is_active and room.occupancy_status == 'Vacant' and room.housekeeping_status == 'Inspected' and room.operational_status == 'In Service'


def overlaps(start, end, other_start, other_end):
    return start < other_end and end > other_start


def inventory(db, type_id):
    return db.scalar(select(func.count(Room.id)).where(Room.room_type_id == type_id, Room.is_active.is_(True), Room.operational_status == 'In Service'))


def peak_booked(db, type_id, start, end, exclude_id=None):
    """Peak nightly consumption, not the count of all intersecting reservations.

    A 2-night request can span two consecutive 1-night bookings of the same room.
    Half-open intervals let departures and arrivals share a turnover date.
    """
    query = select(Reservation).where(Reservation.room_type_id == type_id, Reservation.status.in_(ACTIVE),
                                     Reservation.check_in_date < end, Reservation.check_out_date > start)
    if exclude_id is not None:
        query = query.where(Reservation.id != exclude_id)
    events = {}
    for r in db.scalars(query):
        a, b = max(start, r.check_in_date), min(end, r.check_out_date)
        events[a] = events.get(a, 0) + 1
        events[b] = events.get(b, 0) - 1
    current = peak = 0
    for day in sorted(events):
        current += events[day]
        peak = max(peak, current)
    return peak


def validate_stay(db, data, exclude_id=None):
    if data.check_in_date < now_local().date():
        fail('Check-in date cannot be in the past.', 422)
    room_type = get_or_404(db, RoomType, data.room_type_id)
    if not room_type.is_active:
        fail('This room type is not available for new bookings.')
    if data.guest_count > room_type.capacity:
        fail('Guest count exceeds room type capacity.', 422)
    if inventory(db, room_type.id) <= peak_booked(db, room_type.id, data.check_in_date, data.check_out_date, exclude_id):
        fail('This room type is no longer available for the selected dates.')
    return room_type


def reservation_for(db, identity, user):
    r = get_or_404(db, Reservation, identity)
    if user.role == 'Guest' and (not user.guest_profile or r.guest_id != user.guest_profile.id):
        fail('Record not found.', 404)
    if user.role == 'Housekeeping':
        fail('You do not have permission to view reservations.', 403)
    return r


def arrival_instant(r, hotel):
    return datetime.combine(r.check_in_date, hotel.check_in_time, ZoneInfo(settings.hotel_timezone))


def eligible_change(r, user, hotel):
    if r.status != 'Confirmed':
        fail('Only confirmed reservations can be changed or cancelled.')
    if user.role == 'Guest' and now_local() >= arrival_instant(r, hotel):
        fail('Self-service changes close at the scheduled check-in time.')


def create_reservation(db, data, user):
    room_type = validate_stay(db, data)
    if user.role == 'Guest':
        guest_id = user.guest_profile.id
        if data.guest_id is not None and data.guest_id != guest_id:
            fail('Guests can only book for their own profile.', 403)
    else:
        if data.guest_id is None:
            fail('Please select a guest.', 422)
        guest_id = get_or_404(db, GuestProfile, data.guest_id).id
    nights = (data.check_out_date - data.check_in_date).days
    r = Reservation(guest_id=guest_id, created_by=user.id, room_type_id=room_type.id,
                    check_in_date=data.check_in_date, check_out_date=data.check_out_date,
                    guest_count=data.guest_count, number_of_nights=nights,
                    price_per_night=room_type.base_price_per_night,
                    total_stay_cost=room_type.base_price_per_night * nights, status='Confirmed')
    db.add(r)
    db.flush()
    return r


def modify_reservation(db, r, data, user, hotel):
    eligible_change(r, user, hotel)
    room_type = validate_stay(db, data, r.id)
    if user.role == 'Guest' and datetime.combine(data.check_in_date, hotel.check_in_time, ZoneInfo(settings.hotel_timezone)) <= now_local():
        fail('Choose a future arrival time.', 422)
    changed = (r.room_type_id, r.check_in_date, r.check_out_date) != (data.room_type_id, data.check_in_date, data.check_out_date)
    # All validation finishes before modifying the tracked booking.
    if changed:
        r.assigned_room_id = None
        r.assigned_room = None
    r.room_type_id, r.room_type = room_type.id, room_type
    r.check_in_date, r.check_out_date = data.check_in_date, data.check_out_date
    r.guest_count = data.guest_count
    r.number_of_nights = (data.check_out_date - data.check_in_date).days
    r.price_per_night = room_type.base_price_per_night
    r.total_stay_cost = r.price_per_night * r.number_of_nights
    db.flush()
    return r


def assignment_candidates(db, r):
    rooms = db.scalars(select(Room).where(Room.room_type_id == r.room_type_id, Room.is_active.is_(True), Room.operational_status == 'In Service').order_by(Room.room_number)).all()
    conflicts = set(db.scalars(select(Reservation.assigned_room_id).where(Reservation.id != r.id, Reservation.status.in_(ACTIVE),
                       Reservation.check_in_date < r.check_out_date, Reservation.check_out_date > r.check_in_date)))
    return [room for room in rooms if room.id not in conflicts]


def assign_room(db, r, room_id):
    if r.status != 'Confirmed':
        fail('Room assignment is only available before check-in.')
    room = get_or_404(db, Room, room_id)
    if room.room_type_id != r.room_type_id:
        fail('Assigned room must match the reserved room type.')
    if room.id not in {x.id for x in assignment_candidates(db, r)}:
        fail('Room is unavailable or assigned to an overlapping reservation.')
    r.assigned_room_id = room.id
    r.assigned_room = room
    db.flush()
    return r


def check_in(db, r, hotel):
    if r.status != 'Confirmed':
        fail('Only confirmed reservations can check in.')
    now = now_local()
    if r.check_in_date != now.date():
        fail('Check-in is available on the scheduled arrival date only.')
    if now < arrival_instant(r, hotel):
        fail(f'Check-in opens at {hotel.check_in_time.strftime("%H:%M")} hotel time.')
    if not r.assigned_room_id:
        fail('Assign a room before check-in.')
    room = get_or_404(db, Room, r.assigned_room_id)
    if room.room_type_id != r.room_type_id or not ready(room):
        fail('The assigned room must be vacant, inspected, and in service.')
    if room.id not in {x.id for x in assignment_candidates(db, r)}:
        fail('Room has a conflicting reservation.')
    room.occupancy_status = 'Occupied'
    r.status, r.checked_in_at = 'Checked In', utcnow()
    db.flush()
    return r


def check_out(db, r):
    if r.status != 'Checked In':
        fail('Only checked-in reservations can check out.')
    room = get_or_404(db, Room, r.assigned_room_id)
    r.status, r.checked_out_at = 'Checked Out', utcnow()
    room.occupancy_status, room.housekeeping_status = 'Vacant', 'Dirty'
    same_day = db.scalar(select(Reservation.id).where(Reservation.assigned_room_id == room.id, Reservation.status == 'Confirmed', Reservation.check_in_date == now_local().date()).limit(1))
    db.add(HousekeepingTask(room_id=room.id, reservation_id=r.id, status='Open', priority='High' if same_day else 'Normal'))
    db.flush()
    return r


def remove_inventory_guard(db, room):
    if room.occupancy_status == 'Occupied':
        fail('An occupied room cannot be removed from service.')
    if db.scalar(select(Reservation.id).where(Reservation.assigned_room_id == room.id, Reservation.status.in_(ACTIVE)).limit(1)):
        fail('Reassign or cancel active reservations before removing this room from service.')
    today = now_local().date()
    last = db.scalar(select(func.max(Reservation.check_out_date)).where(Reservation.room_type_id == room.room_type_id, Reservation.status.in_(ACTIVE)))
    if last and last > today and peak_booked(db, room.room_type_id, today, last) > inventory(db, room.room_type_id) - 1:
        fail('Removing this room would leave existing reservations without enough inventory.')


def task_for(db, task_id, user):
    task = get_or_404(db, HousekeepingTask, task_id)
    if user.role == 'Housekeeping' and task.assigned_staff_id != user.id:
        fail('Record not found.', 404)
    return task
