from datetime import date
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from . import schemas as s, services as svc
from .config import settings
from .models import GuestProfile, HotelSettings, HousekeepingTask, Reservation, Room, RoomIssue, RoomType, User, utcnow
from .presenters import columns, reservation_view, room_view, task_view, user_view
from .security import Admin, Booker, Current, Db, FrontDesk, Housekeeper, Staff, DUMMY_HASH, hasher, issue_token, verify_password

app = FastAPI(title='Haven Hotel PMS', version='current', description='Single-hotel reservations and room operations. All dates use the configured hotel timezone.')
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH'], allow_headers=['Authorization', 'Content-Type'])


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, error: IntegrityError):
    return JSONResponse(status_code=409, content={'detail': 'This change conflicts with an existing record or hotel integrity rule.'})


@app.get('/api/health', tags=['system'])
def health(db: Db):
    db.execute(text('SELECT 1'))
    return {'status': 'ok'}


@app.post('/api/auth/register', status_code=201, tags=['auth'])
def register(data: s.Register, db: Db):
    if db.scalar(select(User).where(User.email == data.email)):
        svc.fail('This email is already registered.', 409)
    user = User(name=data.name, email=data.email, password_hash=hasher.hash(data.password), role='Guest')
    db.add(user)
    db.flush()
    profile = GuestProfile(user_id=user.id, name=data.name, email=data.email)
    db.add(profile)
    db.flush()
    user.guest_profile = profile
    return {'access_token': issue_token(user), 'token_type': 'bearer', 'user': user_view(user)}


@app.post('/api/auth/login', tags=['auth'])
def login(data: s.Login, db: Db):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    valid = verify_password(user.password_hash if user else DUMMY_HASH, data.password)
    if not valid or not user or not user.is_active:
        raise HTTPException(401, 'Email or password is incorrect.')
    return {'access_token': issue_token(user), 'token_type': 'bearer', 'user': user_view(user)}


@app.post('/api/auth/logout', tags=['auth'])
def logout(user: Current, db: Db):
    # Invalidates all of this user's outstanding JWTs, including copied tokens.
    db.execute(User.__table__.update().where(User.id == user.id).values(token_version=User.token_version + 1))
    return {'message': 'Signed out.'}


@app.get('/api/auth/me', tags=['auth'])
def me(user: Current):
    return user_view(user)


@app.put('/api/profile', tags=['auth'])
def profile(data: s.ProfileUpdate, user: Current, db: Db):
    user.name = data.name
    if user.guest_profile:
        user.guest_profile.name, user.guest_profile.phone = data.name, data.phone
    db.flush()
    return user_view(user)


@app.get('/api/settings', tags=['configuration'])
def hotel_settings(db: Db):
    hotel = svc.get_or_404(db, HotelSettings, 1)
    return {**columns(hotel), 'timezone': settings.hotel_timezone, 'today': svc.now_local().date(), 'local_time': svc.now_local().isoformat()}


@app.put('/api/settings', tags=['configuration'])
def update_settings(data: s.SettingsUpdate, user: Admin, db: Db):
    hotel = svc.lock_hotel(db)
    for k, v in data.model_dump().items():
        setattr(hotel, k, v)
    db.flush()
    return columns(hotel)


@app.get('/api/users', tags=['users'])
def users(user: Admin, db: Db):
    return [user_view(u) for u in db.scalars(select(User).order_by(User.id))]


@app.get('/api/staff/housekeeping', tags=['users'])
def housekeeping_staff(user: FrontDesk, db: Db):
    return [{'id': u.id, 'name': u.name} for u in db.scalars(select(User).where(User.role == 'Housekeeping', User.is_active.is_(True)))]


@app.post('/api/users', status_code=201, tags=['users'])
def create_staff(data: s.StaffCreate, user: Admin, db: Db):
    u = User(name=data.name, email=data.email, password_hash=hasher.hash(data.password), role=data.role)
    db.add(u)
    db.flush()
    return user_view(u)


@app.put('/api/users/{identity}', tags=['users'])
def update_staff(identity: int, data: s.StaffUpdate, user: Admin, db: Db):
    svc.lock_hotel(db)
    target = svc.get_or_404(db, User, identity)
    if target.role not in ('Receptionist', 'Housekeeping'):
        svc.fail('This screen only manages receptionist and housekeeping accounts.', 403)
    if not data.is_active and db.scalar(select(HousekeepingTask.id).where(HousekeepingTask.assigned_staff_id == identity, HousekeepingTask.status != 'Completed').limit(1)):
        svc.fail('Reassign this staff member’s open tasks before disabling their account.')
    target.name, target.is_active = data.name, data.is_active
    if not data.is_active:
        target.token_version += 1
    db.flush()
    return user_view(target)


@app.get('/api/guests', tags=['guests'])
def guests(user: FrontDesk, db: Db, q: str = ''):
    query = select(GuestProfile).order_by(GuestProfile.name)
    if q:
        query = query.where(GuestProfile.name.ilike(f'%{q}%') | GuestProfile.email.ilike(f'%{q}%'))
    return [columns(g) for g in db.scalars(query)]


@app.post('/api/guests', status_code=201, tags=['guests'])
def create_guest(data: s.GuestCreate, user: FrontDesk, db: Db):
    guest = GuestProfile(**data.model_dump())
    db.add(guest)
    db.flush()
    return columns(guest)


@app.get('/api/room-types', tags=['room types'])
def room_types(db: Db, include_inactive: bool = False):
    # Public descriptive catalog; inactive records have no bookable inventory.
    query = select(RoomType).order_by(RoomType.base_price_per_night)
    if not include_inactive:
        query = query.where(RoomType.is_active.is_(True))
    return [columns(t) for t in db.scalars(query)]


@app.get('/api/room-types/{identity}', tags=['room types'])
def room_type_detail(identity: int, db: Db):
    return columns(svc.get_or_404(db, RoomType, identity))


@app.post('/api/room-types', status_code=201, tags=['room types'])
def create_type(data: s.TypeInput, user: Admin, db: Db):
    svc.lock_hotel(db)
    t = RoomType(**data.model_dump())
    db.add(t)
    db.flush()
    return columns(t)


@app.put('/api/room-types/{identity}', tags=['room types'])
def update_type(identity: int, data: s.TypeInput, user: Admin, db: Db):
    svc.lock_hotel(db)
    t = svc.get_or_404(db, RoomType, identity)
    if db.scalar(select(Reservation.id).where(Reservation.room_type_id == identity, Reservation.status.in_(svc.ACTIVE), Reservation.guest_count > data.capacity).limit(1)):
        svc.fail('The new capacity would invalidate an active reservation.')
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.flush()
    return columns(t)


@app.get('/api/availability', tags=['availability'])
def availability(db: Db, check_in_date: date, check_out_date: date, guest_count: int = Query(ge=1, le=20), exclude_reservation_id: int | None = None):
    if exclude_reservation_id is not None:
        # Exclusion is deliberately not exposed publicly; edit validation uses it internally.
        svc.fail('Use reservation modification to validate an existing booking.', 422)
    if check_in_date < svc.now_local().date() or not 0 < (check_out_date - check_in_date).days <= 365:
        svc.fail('Choose a valid future stay of 1–365 nights.', 422)
    nights = (check_out_date - check_in_date).days
    result = []
    for t in db.scalars(select(RoomType).where(RoomType.is_active.is_(True), RoomType.capacity >= guest_count).order_by(RoomType.base_price_per_night)):
        remaining = svc.inventory(db, t.id) - svc.peak_booked(db, t.id, check_in_date, check_out_date)
        if remaining > 0:
            result.append({**columns(t), 'available_rooms': remaining, 'number_of_nights': nights, 'total_stay_cost': nights * t.base_price_per_night})
    return result


@app.get('/api/rooms', tags=['rooms'])
def rooms(user: FrontDesk, db: Db):
    return [room_view(r) for r in db.scalars(select(Room).options(selectinload(Room.room_type)).order_by(Room.room_number))]


@app.post('/api/rooms', status_code=201, tags=['rooms'])
def create_room(data: s.RoomCreate, user: Admin, db: Db):
    svc.lock_hotel(db)
    svc.get_or_404(db, RoomType, data.room_type_id)
    room = Room(**data.model_dump())
    db.add(room)
    db.flush()
    return room_view(room)


@app.put('/api/rooms/{identity}', tags=['rooms'])
def update_room(identity: int, data: s.RoomUpdate, user: Admin, db: Db):
    svc.lock_hotel(db)
    room = svc.get_or_404(db, Room, identity)
    if room.is_active and not data.is_active:
        if room.operational_status == 'In Service':
            svc.remove_inventory_guard(db, room)
        if db.scalar(select(HousekeepingTask.id).where(HousekeepingTask.room_id == room.id, HousekeepingTask.status != 'Completed').limit(1)):
            svc.fail('Complete housekeeping work before deactivating this room.')
    for k, v in data.model_dump().items():
        setattr(room, k, v)
    db.flush()
    return room_view(room)


@app.patch('/api/rooms/{identity}/operational', tags=['rooms'])
def operational(identity: int, data: s.OperationalUpdate, user: FrontDesk, db: Db):
    svc.lock_hotel(db)
    room = svc.get_or_404(db, Room, identity)
    if data.operational_status == 'Out of Order' and room.operational_status == 'In Service' and room.is_active:
        svc.remove_inventory_guard(db, room)
    room.operational_status = data.operational_status
    db.flush()
    return room_view(room)


@app.post('/api/rooms/{identity}/inspect', tags=['rooms'])
def inspect_room(identity: int, user: FrontDesk, db: Db):
    svc.lock_hotel(db)
    room = svc.get_or_404(db, Room, identity)
    if room.occupancy_status != 'Vacant' or room.housekeeping_status != 'Clean' or room.operational_status != 'In Service' or not room.is_active:
        svc.fail('Inspection requires an active, vacant, clean room in service.')
    room.housekeeping_status = 'Inspected'
    db.flush()
    return room_view(room)


@app.get('/api/reservations', tags=['reservations'])
def reservations(user: Booker, db: Db, status: str | None = None, q: str = '', arrival: date | None = None, departure: date | None = None):
    query = select(Reservation).options(selectinload(Reservation.guest), selectinload(Reservation.room_type), selectinload(Reservation.assigned_room)).order_by(Reservation.check_in_date.desc(), Reservation.id.desc())
    if user.role == 'Guest':
        query = query.where(Reservation.guest_id == user.guest_profile.id)
    if status:
        query = query.where(Reservation.status == status)
    if arrival:
        query = query.where(Reservation.check_in_date == arrival)
    if departure:
        query = query.where(Reservation.check_out_date == departure)
    result = [reservation_view(r) for r in db.scalars(query)]
    return [r for r in result if not q or q.lower() in f'{r["reference"]} {r["guest_name"]} {r["room_number"]}'.lower()]


@app.post('/api/reservations', status_code=201, tags=['reservations'])
def create_reservation(data: s.ReservationCreate, user: Booker, db: Db):
    svc.lock_hotel(db)
    return reservation_view(svc.create_reservation(db, data, user))


@app.post('/api/walk-ins', status_code=201, tags=['reservations'])
def walk_in(data: s.WalkIn, user: FrontDesk, db: Db):
    hotel = svc.lock_hotel(db)
    if data.check_in_date != svc.now_local().date():
        svc.fail('Walk-ins must arrive today.', 422)
    r = svc.create_reservation(db, data, user)
    svc.assign_room(db, r, data.room_id)
    return reservation_view(svc.check_in(db, r, hotel))


@app.get('/api/reservations/{identity}', tags=['reservations'])
def reservation(identity: int, user: Booker, db: Db):
    return reservation_view(svc.reservation_for(db, identity, user))


@app.put('/api/reservations/{identity}', tags=['reservations'])
def modify(identity: int, data: s.Stay, user: Booker, db: Db):
    hotel = svc.lock_hotel(db)
    r = svc.reservation_for(db, identity, user)
    return reservation_view(svc.modify_reservation(db, r, data, user, hotel))


@app.post('/api/reservations/{identity}/cancel', tags=['reservations'])
def cancel(identity: int, user: Booker, db: Db):
    hotel = svc.lock_hotel(db)
    r = svc.reservation_for(db, identity, user)
    svc.eligible_change(r, user, hotel)
    r.status, r.cancelled_at = 'Cancelled', utcnow()
    db.flush()
    return reservation_view(r)


@app.post('/api/reservations/{identity}/no-show', tags=['reservations'])
def no_show(identity: int, user: FrontDesk, db: Db):
    hotel = svc.lock_hotel(db)
    r = svc.reservation_for(db, identity, user)
    if r.status != 'Confirmed' or svc.now_local() < svc.arrival_instant(r, hotel):
        svc.fail('No-show is available for confirmed bookings after the scheduled arrival time.')
    r.status, r.no_show_at = 'No-show', utcnow()
    db.flush()
    return reservation_view(r)


@app.get('/api/reservations/{identity}/rooms', tags=['reservations'])
def candidate_rooms(identity: int, user: FrontDesk, db: Db):
    r = svc.reservation_for(db, identity, user)
    return [room_view(room) for room in svc.assignment_candidates(db, r)]


@app.post('/api/reservations/{identity}/assign', tags=['reservations'])
def assign(identity: int, data: s.Assignment, user: FrontDesk, db: Db):
    svc.lock_hotel(db)
    return reservation_view(svc.assign_room(db, svc.reservation_for(db, identity, user), data.room_id))


@app.post('/api/reservations/{identity}/check-in', tags=['reservations'])
def check_in(identity: int, user: FrontDesk, db: Db):
    hotel = svc.lock_hotel(db)
    return reservation_view(svc.check_in(db, svc.reservation_for(db, identity, user), hotel))


@app.post('/api/reservations/{identity}/check-out', tags=['reservations'])
def check_out(identity: int, user: FrontDesk, db: Db):
    svc.lock_hotel(db)
    return reservation_view(svc.check_out(db, svc.reservation_for(db, identity, user)))


@app.get('/api/housekeeping/tasks', tags=['housekeeping'])
def tasks(user: Staff, db: Db):
    query = select(HousekeepingTask).options(selectinload(HousekeepingTask.room).selectinload(Room.room_type), selectinload(HousekeepingTask.assigned_staff)).order_by(HousekeepingTask.created_at.desc())
    if user.role == 'Housekeeping':
        query = query.where(HousekeepingTask.assigned_staff_id == user.id)
    return [task_view(t) for t in db.scalars(query)]


@app.get('/api/housekeeping/tasks/{identity}', tags=['housekeeping'])
def task_detail(identity: int, user: Staff, db: Db):
    return task_view(svc.task_for(db, identity, user))


@app.post('/api/housekeeping/tasks/{identity}/assign', tags=['housekeeping'])
def assign_task(identity: int, data: s.TaskAssignment, user: FrontDesk, db: Db):
    svc.lock_hotel(db)
    task = svc.task_for(db, identity, user)
    target = svc.get_or_404(db, User, data.assigned_staff_id)
    if task.status != 'Open' or target.role != 'Housekeeping' or not target.is_active:
        svc.fail('Assign an open task to an active housekeeping staff member.')
    task.assigned_staff_id, task.assigned_staff, task.priority = target.id, target, data.priority
    db.flush()
    return task_view(task)


@app.post('/api/housekeeping/tasks/{identity}/start', tags=['housekeeping'])
def start_task(identity: int, user: Housekeeper, db: Db):
    svc.lock_hotel(db)
    task = svc.task_for(db, identity, user)
    if task.status != 'Open' or task.room.occupancy_status != 'Vacant':
        svc.fail('Only open tasks for vacant rooms can be started.')
    task.status, task.started_at = 'In Progress', utcnow()
    db.flush()
    return task_view(task)


@app.post('/api/housekeeping/tasks/{identity}/complete', tags=['housekeeping'])
def complete_task(identity: int, data: s.TaskComplete, user: Housekeeper, db: Db):
    svc.lock_hotel(db)
    task = svc.task_for(db, identity, user)
    if task.status != 'In Progress' or task.room.occupancy_status != 'Vacant':
        svc.fail('Start cleaning this vacant room before completing the task.')
    task.status, task.completed_at, task.notes = 'Completed', utcnow(), data.notes
    task.room.housekeeping_status = 'Clean'
    db.flush()
    return task_view(task)


@app.get('/api/issues', tags=['room issues'])
def issues(user: Staff, db: Db):
    query = select(RoomIssue).order_by(RoomIssue.reported_at.desc())
    if user.role == 'Housekeeping':
        query = query.where(RoomIssue.reported_by == user.id)
    return [{**columns(i), 'room_number': i.room.room_number} for i in db.scalars(query)]


@app.post('/api/issues', status_code=201, tags=['room issues'])
def report_issue(data: s.IssueCreate, user: Staff, db: Db):
    svc.lock_hotel(db)
    svc.get_or_404(db, Room, data.room_id)
    if user.role == 'Housekeeping' and not db.scalar(select(HousekeepingTask.id).where(HousekeepingTask.room_id == data.room_id, HousekeepingTask.assigned_staff_id == user.id).limit(1)):
        svc.fail('You can report issues for rooms assigned to you.', 403)
    issue = RoomIssue(**data.model_dump(), reported_by=user.id)
    db.add(issue)
    db.flush()
    return columns(issue)


@app.post('/api/issues/{identity}/resolve', tags=['room issues'])
def resolve_issue(identity: int, user: FrontDesk, db: Db):
    svc.lock_hotel(db)
    issue = svc.get_or_404(db, RoomIssue, identity)
    issue.status, issue.resolved_at = 'Resolved', utcnow()
    db.flush()
    return columns(issue)


@app.get('/api/dashboard', tags=['dashboard'])
def dashboard(user: Current, db: Db):
    today = svc.now_local().date()
    if user.role == 'Guest':
        bookings = db.scalars(select(Reservation).where(Reservation.guest_id == user.guest_profile.id).order_by(Reservation.check_in_date.desc())).all()
        return {'reservations': [reservation_view(r) for r in bookings], 'today': today}
    if user.role == 'Housekeeping':
        assigned = db.scalars(select(HousekeepingTask).where(HousekeepingTask.assigned_staff_id == user.id)).all()
        return {'tasks': [task_view(t) for t in assigned], 'today': today}
    rooms = db.scalars(select(Room).where(Room.is_active.is_(True)).order_by(Room.room_number)).all()
    arrivals = db.scalars(select(Reservation).where(Reservation.check_in_date == today, Reservation.status.in_(svc.ACTIVE))).all()
    departures = db.scalars(select(Reservation).where(Reservation.check_out_date == today, Reservation.status == 'Checked In')).all()
    recent = db.scalars(select(Reservation).order_by(Reservation.updated_at.desc()).limit(5)).all()
    counts = {'total': len(rooms), 'occupied': sum(r.occupancy_status == 'Occupied' for r in rooms),
              'vacant': sum(r.occupancy_status == 'Vacant' for r in rooms), 'ready': sum(svc.ready(r) for r in rooms),
              'dirty': sum(r.housekeeping_status == 'Dirty' for r in rooms), 'clean': sum(r.housekeeping_status == 'Clean' for r in rooms),
              'inspected': sum(r.housekeeping_status == 'Inspected' for r in rooms), 'out_of_order': sum(r.operational_status == 'Out of Order' for r in rooms),
              'checked_in_today': db.scalar(select(func.count(Reservation.id)).where(Reservation.checked_in_at >= svc.now_local().replace(hour=0, minute=0, second=0, microsecond=0))),
              'checked_out_today': db.scalar(select(func.count(Reservation.id)).where(Reservation.checked_out_at >= svc.now_local().replace(hour=0, minute=0, second=0, microsecond=0)))}
    return {'today': today, 'counts': counts, 'arrivals': [reservation_view(r) for r in arrivals],
            'departures': [reservation_view(r) for r in departures], 'rooms': [room_view(r) for r in rooms],
            'recent': [reservation_view(r) for r in recent], 'open_issues': db.scalar(select(func.count(RoomIssue.id)).where(RoomIssue.status == 'Open'))}
