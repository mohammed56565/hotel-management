from datetime import date, time
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Register(Input):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        return value.lower()

    @field_validator('password')
    @classmethod
    def password_strength(cls, value):
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError('Password must include letters and numbers.')
        return value


class Login(Input):
    email: EmailStr
    password: str = Field(max_length=128)


class StaffCreate(Register):
    role: Literal['Receptionist', 'Housekeeping']


class StaffUpdate(Input):
    name: str = Field(min_length=2, max_length=120)
    is_active: bool


class ProfileUpdate(Input):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(default='', max_length=40)


class GuestCreate(ProfileUpdate):
    email: EmailStr | None = None


class TypeInput(Input):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default='', max_length=2000)
    capacity: int = Field(gt=0, le=20)
    base_price_per_night: Decimal = Field(gt=0, le=1000000, decimal_places=2)
    is_active: bool = True


class RoomCreate(Input):
    room_number: str = Field(min_length=1, max_length=12, pattern=r'^[A-Za-z0-9-]+$')
    room_type_id: int
    floor: int = Field(default=1, ge=-5, le=200)
    notes: str = Field(default='', max_length=2000)


class RoomUpdate(Input):
    room_number: str = Field(min_length=1, max_length=12, pattern=r'^[A-Za-z0-9-]+$')
    floor: int = Field(ge=-5, le=200)
    notes: str = Field(default='', max_length=2000)
    is_active: bool


class OperationalUpdate(Input):
    operational_status: Literal['In Service', 'Out of Order']


class Stay(Input):
    room_type_id: int
    check_in_date: date
    check_out_date: date
    guest_count: int = Field(gt=0, le=20)

    @model_validator(mode='after')
    def valid_dates(self):
        if self.check_out_date <= self.check_in_date:
            raise ValueError('Check-out date must be after check-in date.')
        if (self.check_out_date - self.check_in_date).days > 365:
            raise ValueError('Stays are limited to 365 nights.')
        return self


class ReservationCreate(Stay):
    guest_id: int | None = None


class WalkIn(ReservationCreate):
    room_id: int


class Assignment(Input):
    room_id: int


class TaskAssignment(Input):
    assigned_staff_id: int
    priority: Literal['Normal', 'High'] = 'Normal'


class TaskComplete(Input):
    notes: str = Field(default='', max_length=2000)


class IssueCreate(Input):
    room_id: int
    description: str = Field(min_length=5, max_length=2000)


class SettingsUpdate(Input):
    hotel_name: str = Field(min_length=2, max_length=120)
    check_in_time: time
    check_out_time: time

    @model_validator(mode='after')
    def turnover(self):
        if self.check_out_time >= self.check_in_time:
            raise ValueError('Check-out must be earlier than check-in to allow turnover.')
        return self
