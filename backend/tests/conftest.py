import os
from datetime import datetime, time
from zoneinfo import ZoneInfo
from pathlib import Path
import pytest
from sqlalchemy.engine import make_url

# Never use the application database implicitly. The explicit PostgreSQL test DB
# must end in _test; otherwise this suite uses a disposable local SQLite file.
url = os.environ.get('TEST_DATABASE_URL', 'sqlite:///./hotel_test.db')
parsed = make_url(url)
if parsed.get_backend_name() == 'postgresql' and not (parsed.database or '').endswith('_test'):
    raise RuntimeError('Refusing to reset a database whose name does not end in _test.')
os.environ['DATABASE_URL'] = url
os.environ['JWT_SECRET'] = 'test-only-secret-not-for-production-0000000000'

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.db import Base, engine, SessionLocal
from app.models import GuestProfile, HotelSettings, Room, RoomType, User
from app.security import hasher, issue_token
from app import services

PASSWORD = 'TestingPass123!'
ENCODED = hasher.hash(PASSWORD)


@pytest.fixture(scope='session', autouse=True)
def schema():
    if engine.dialect.name == 'postgresql':
        from alembic.config import Config
        from alembic import command
        command.upgrade(Config('alembic.ini'), 'head')
    else:
        Base.metadata.create_all(engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def reset(monkeypatch, schema):
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    monkeypatch.setattr(services, 'now_local', lambda: datetime(2030, 10, 10, 16, 0, tzinfo=ZoneInfo('Asia/Riyadh')))


@pytest.fixture
def fixture():
    result = {'headers': {}, 'users': {}, 'guests': {}, 'types': [], 'rooms': []}
    with SessionLocal.begin() as db:
        db.add(HotelSettings(id=1, hotel_name='Test Hotel', check_in_time=time(15), check_out_time=time(12)))
        for key, role in [('admin','Admin'),('reception','Receptionist'),('hk','Housekeeping'),('hk2','Housekeeping'),('guest','Guest'),('other','Guest')]:
            user = User(name=key.title()+' User', email=key+'@example.com', password_hash=ENCODED, role=role)
            db.add(user)
            db.flush()
            result['users'][key] = user.id
            result['headers'][key] = {'Authorization':'Bearer '+issue_token(user)}
            if role == 'Guest':
                guest = GuestProfile(user_id=user.id, name=user.name, email=user.email)
                db.add(guest)
                db.flush()
                result['guests'][key] = guest.id
        for name, capacity, price in [('Standard King',2,450),('Suite',4,950)]:
            t = RoomType(name=name, description='Test room type', capacity=capacity, base_price_per_night=price)
            db.add(t)
            db.flush()
            result['types'].append(t.id)
            room = Room(room_number=str(101+len(result['rooms'])), room_type_id=t.id)
            db.add(room)
            db.flush()
            result['rooms'].append(room.id)
    return result


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def call(client, fixture):
    def request(method, path, body=None, role='reception'):
        return client.request(method, '/api'+path, json=body, headers=fixture['headers'][role])
    return request


@pytest.fixture
def stay(fixture):
    return {'room_type_id':fixture['types'][0], 'check_in_date':'2030-10-10', 'check_out_date':'2030-10-13', 'guest_count':2, 'guest_id':fixture['guests']['guest']}


@pytest.fixture
def booked(call, stay):
    response = call('POST', '/reservations', stay)
    assert response.status_code == 201, response.text
    return response.json()
