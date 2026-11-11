"""Default hotel settings and four initial room types.

Revision ID: 002
Revises: 988add8ceece
"""
from datetime import datetime, time, timezone
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '988add8ceece'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    stamp = datetime.now(timezone.utc)
    hotel = sa.table('hotel_settings', sa.column('id', sa.Integer), sa.column('hotel_name', sa.String),
        sa.column('check_in_time', sa.Time), sa.column('check_out_time', sa.Time),
        sa.column('created_at', sa.DateTime), sa.column('updated_at', sa.DateTime))
    # A downgrade retains operational data. Reapplying must preserve the hotel's
    # edited settings and room types rather than recreating the defaults.
    if connection.scalar(sa.select(hotel.c.id).where(hotel.c.id == 1)) is None:
        op.bulk_insert(hotel, [dict(id=1, hotel_name='Haven Hotel', check_in_time=time(15), check_out_time=time(12), created_at=stamp, updated_at=stamp)])
    types = sa.table('room_types', sa.column('name', sa.String), sa.column('description', sa.Text),
        sa.column('capacity', sa.Integer), sa.column('base_price_per_night', sa.Numeric),
        sa.column('is_active', sa.Boolean), sa.column('created_at', sa.DateTime), sa.column('updated_at', sa.DateTime))
    data = [('Standard King', 'A restful retreat with a generous king bed, warm natural tones, and space to settle in.', 2, 450),
            ('Standard Twin', 'Two comfortable beds and thoughtful essentials. A welcoming space for shared adventures.', 2, 450),
            ('Deluxe King', 'A little extra room to unwind, with a king bed and an inviting sitting area.', 2, 600),
            ('Suite', 'A spacious escape with a separate living area. Made for longer stays and time together.', 4, 950)]
    if connection.execute(sa.select(types.c.name).limit(1)).first() is None:
        op.bulk_insert(types, [dict(name=n, description=d, capacity=c, base_price_per_night=p, is_active=True, created_at=stamp, updated_at=stamp) for n,d,c,p in data])
    if connection.dialect.name == 'postgresql':
        op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist')
        op.execute("""ALTER TABLE reservations ADD CONSTRAINT no_overlapping_room_assignment
            EXCLUDE USING gist (assigned_room_id WITH =, daterange(check_in_date, check_out_date, '[)') WITH &&)
            WHERE (assigned_room_id IS NOT NULL AND status IN ('Confirmed', 'Checked In'))""")


def downgrade():
    if op.get_bind().dialect.name == 'postgresql':
        op.drop_constraint('no_overlapping_room_assignment', 'reservations')
    # Do not delete possibly referenced operational data during a schema rollback.
    # Downgrading the initial schema removes the tables explicitly.
