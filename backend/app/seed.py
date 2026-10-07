"""Explicit opt-in demo data. Run only against a development database."""
import argparse
from datetime import timedelta
from decimal import Decimal
from sqlalchemy import select
from .db import SessionLocal
from .models import GuestProfile, HousekeepingTask, Reservation, Room, RoomIssue, RoomType, User, utcnow
from .security import hasher
from .services import lock_hotel, now_local


def main():
    parser = argparse.ArgumentParser(description='Create sample hotel data and four demo accounts.')
    parser.add_argument('--demo', action='store_true', required=True, help='Acknowledge these accounts use a documented demo password.')
    parser.parse_args()
    with SessionLocal.begin() as db:
        lock_hotel(db)
        if db.scalar(select(User.id).limit(1)) or db.scalar(select(Room.id).limit(1)):
            raise SystemExit('Seeding requires an empty hotel. Existing data was left unchanged.')
        accounts = [('Admin', 'Alex Morgan', 'admin@example.com'), ('Receptionist', 'Maya Bennett', 'reception@example.com'),
                    ('Housekeeping', 'Sofia Reyes', 'housekeeping@example.com'), ('Guest', 'Jordan Taylor', 'guest@example.com')]
        users = {}
        for role, name, email in accounts:
            u = User(name=name, email=email, role=role, password_hash=hasher.hash('HavenDemo2026!'))
            db.add(u)
            db.flush()
            users[role] = u
        names = ['Jordan Taylor', 'Amelia Reed', 'Omar Hassan', 'Sophie Laurent', 'Daniel Park', 'Layla Mansour', 'Oliver James', 'Isabella Rossi', 'Ethan Brooks', 'Nora Wilson', 'Liam Carter', 'Mia Chen']
        guests = []
        for i, name in enumerate(names):
            g = GuestProfile(user_id=users['Guest'].id if i == 0 else None, name=name,
                             email='guest@example.com' if i == 0 else name.lower().replace(' ', '.')+'@example.com', phone='')
            db.add(g)
            db.flush()
            guests.append(g)
        types = db.scalars(select(RoomType).order_by(RoomType.id)).all()
        rooms = []
        for floor in (1, 2):
            for n in range(1, 9):
                r = Room(room_number=f'{floor}{n:02d}', room_type_id=types[(n-1)//2].id, floor=floor)
                db.add(r)
                db.flush()
                rooms.append(r)
        today = now_local().date()
        def booking(guest, room, start, end, status, assigned=True):
            t = next(t for t in types if t.id == room.room_type_id)
            nights = (end-start).days
            r = Reservation(guest_id=guest.id, room_type_id=t.id, assigned_room_id=room.id if assigned else None,
                check_in_date=start, check_out_date=end, guest_count=2, number_of_nights=nights,
                price_per_night=t.base_price_per_night, total_stay_cost=t.base_price_per_night*nights,
                status=status, created_by=users['Receptionist'].id,
                checked_in_at=utcnow()-timedelta(days=2) if status in ('Checked In','Checked Out') else None,
                checked_out_at=utcnow() if status=='Checked Out' else None)
            db.add(r)
            db.flush()
            if status == 'Checked In':
                room.occupancy_status = 'Occupied'
            return r
        for i in range(6):
            booking(guests[i+1], rooms[i], today-timedelta(days=2), today if i<2 else today+timedelta(days=2), 'Checked In')
        for i in range(4):
            booking(guests[i+7], rooms[i+8], today, today+timedelta(days=2+(i%2)), 'Confirmed', assigned=i<3)
        booking(guests[0], rooms[6], today+timedelta(days=4), today+timedelta(days=7), 'Confirmed', assigned=False)
        for i, room_index in enumerate((6,7,12,13)):
            room = rooms[room_index]
            completed = i == 3
            room.housekeeping_status = 'Clean' if completed else 'Dirty'
            stay = booking(guests[i+2], room, today-timedelta(days=2), today, 'Checked Out')
            db.add(HousekeepingTask(room_id=room.id, reservation_id=stay.id,
                assigned_staff_id=users['Housekeeping'].id if i!=2 else None,
                status='Completed' if completed else 'In Progress' if i==1 else 'Open',
                priority='High' if i==0 else 'Normal',
                started_at=utcnow() if completed or i==1 else None, completed_at=utcnow() if completed else None,
                notes='All surfaces cleaned and linens refreshed.' if completed else ''))
        rooms[15].operational_status = 'Out of Order'
        db.add(RoomIssue(room_id=rooms[15].id, reported_by=users['Housekeeping'].id,
                         description='Air conditioning is not cooling. Please inspect before returning the room to service.'))
    print('Demo hotel created. See README for the four demo accounts.')


if __name__ == '__main__':
    main()
