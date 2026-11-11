from decimal import Decimal

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import HotelSettings, RoomType


def snapshot():
    with engine.connect() as connection:
        return {
            table.name: connection.execute(select(table).order_by(table.c.id)).all()
            for table in Base.metadata.sorted_tables
        }


def test_configuration_reapply_preserves_operational_data(fixture, booked):
    with SessionLocal.begin() as db:
        db.get(HotelSettings, 1).hotel_name = 'Custom Hotel'
        room_type = db.get(RoomType, fixture['types'][0])
        room_type.name = 'Custom King'
        room_type.base_price_per_night = Decimal('725.00')

    before = snapshot()
    config = Config('alembic.ini')
    # SQLite business tests create tables directly, so stamp their schema first.
    command.stamp(config, 'head')
    command.downgrade(config, '988add8ceece')
    try:
        assert snapshot() == before
    finally:
        command.upgrade(config, 'head')
    assert snapshot() == before
    if engine.dialect.name == 'postgresql':
        with engine.connect() as connection:
            assert connection.scalar(text(
                "SELECT count(*) FROM pg_constraint "
                "WHERE conname = 'no_overlapping_room_assignment'"
            )) == 1


def test_fresh_migrations_create_defaults(tmp_path, monkeypatch):
    url = 'sqlite:///' + (tmp_path / 'fresh-hotel.db').as_posix()
    monkeypatch.setattr(settings, 'database_url', url)
    command.upgrade(Config('alembic.ini'), 'head')
    fresh = create_engine(url)
    try:
        with fresh.connect() as connection:
            assert connection.scalar(text('SELECT count(*) FROM hotel_settings')) == 1
            assert connection.scalar(text('SELECT count(*) FROM room_types')) == 4
        command.downgrade(Config('alembic.ini'), 'base')
        command.upgrade(Config('alembic.ini'), 'head')
        with fresh.connect() as connection:
            assert connection.scalar(text('SELECT count(*) FROM hotel_settings')) == 1
            assert connection.scalar(text('SELECT count(*) FROM room_types')) == 4
    finally:
        fresh.dispose()
