from datetime import date, datetime, time, timezone
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def utcnow():
    return datetime.now(timezone.utc)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class User(Timestamps, Base):
    __tablename__ = 'users'
    __table_args__ = (CheckConstraint("role IN ('Admin','Receptionist','Housekeeping','Guest')", name='user_role'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(24))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(default=0)
    guest_profile: Mapped['GuestProfile | None'] = relationship(back_populates='user', uselist=False)


class GuestProfile(Timestamps, Base):
    __tablename__ = 'guest_profiles'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str] = mapped_column(String(40), default='')
    user: Mapped[User | None] = relationship(back_populates='guest_profile')


class HotelSettings(Timestamps, Base):
    __tablename__ = 'hotel_settings'
    __table_args__ = (CheckConstraint('id = 1', name='singleton_hotel'), CheckConstraint('check_out_time < check_in_time', name='turnover_window'))
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    hotel_name: Mapped[str] = mapped_column(String(120), default='Haven Hotel')
    check_in_time: Mapped[time] = mapped_column(Time, default=time(15))
    check_out_time: Mapped[time] = mapped_column(Time, default=time(12))


class RoomType(Timestamps, Base):
    __tablename__ = 'room_types'
    __table_args__ = (CheckConstraint('capacity > 0', name='positive_capacity'), CheckConstraint('base_price_per_night > 0', name='positive_price'))
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str] = mapped_column(Text, default='')
    capacity: Mapped[int] = mapped_column(Integer)
    base_price_per_night: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Room(Timestamps, Base):
    __tablename__ = 'rooms'
    __table_args__ = (
        CheckConstraint("occupancy_status IN ('Vacant','Occupied')", name='occupancy_state'),
        CheckConstraint("housekeeping_status IN ('Dirty','Clean','Inspected')", name='cleanliness_state'),
        CheckConstraint("operational_status IN ('In Service','Out of Order')", name='operation_state'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(String(12), unique=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey('room_types.id'), index=True)
    floor: Mapped[int] = mapped_column(default=1)
    notes: Mapped[str] = mapped_column(Text, default='')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    occupancy_status: Mapped[str] = mapped_column(String(16), default='Vacant')
    housekeeping_status: Mapped[str] = mapped_column(String(16), default='Inspected')
    operational_status: Mapped[str] = mapped_column(String(20), default='In Service')
    room_type: Mapped[RoomType] = relationship()


class Reservation(Timestamps, Base):
    __tablename__ = 'reservations'
    __table_args__ = (
        CheckConstraint('check_out_date > check_in_date', name='valid_stay'),
        CheckConstraint('guest_count > 0 AND number_of_nights > 0', name='positive_stay'),
        CheckConstraint('price_per_night > 0 AND total_stay_cost = price_per_night * number_of_nights', name='valid_cost'),
        CheckConstraint("status IN ('Confirmed','Checked In','Checked Out','Cancelled','No-show')", name='reservation_state'),
        Index('ix_reservation_inventory', 'room_type_id', 'status', 'check_in_date', 'check_out_date'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey('guest_profiles.id'), index=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey('room_types.id'))
    assigned_room_id: Mapped[int | None] = mapped_column(ForeignKey('rooms.id'), index=True)
    check_in_date: Mapped[date] = mapped_column(Date)
    check_out_date: Mapped[date] = mapped_column(Date)
    guest_count: Mapped[int] = mapped_column(Integer)
    number_of_nights: Mapped[int] = mapped_column(Integer)
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_stay_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(20), default='Confirmed')
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    no_show_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    guest: Mapped[GuestProfile] = relationship()
    room_type: Mapped[RoomType] = relationship()
    assigned_room: Mapped[Room | None] = relationship()


class HousekeepingTask(Timestamps, Base):
    __tablename__ = 'housekeeping_tasks'
    __table_args__ = (
        CheckConstraint("status IN ('Open','In Progress','Completed')", name='task_state'),
        CheckConstraint("priority IN ('Normal','High')", name='task_priority'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey('rooms.id'))
    reservation_id: Mapped[int | None] = mapped_column(ForeignKey('reservations.id'), unique=True)
    assigned_staff_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    status: Mapped[str] = mapped_column(String(16), default='Open')
    priority: Mapped[str] = mapped_column(String(10), default='Normal')
    notes: Mapped[str] = mapped_column(Text, default='')
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    room: Mapped[Room] = relationship()
    assigned_staff: Mapped[User | None] = relationship()


class RoomIssue(Base):
    __tablename__ = 'room_issues'
    __table_args__ = (CheckConstraint("status IN ('Open','Resolved')", name='issue_state'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey('rooms.id'))
    reported_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default='Open')
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    room: Mapped[Room] = relationship()
