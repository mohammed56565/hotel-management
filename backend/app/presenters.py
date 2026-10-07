from .services import ready


def columns(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def user_view(user):
    return {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role,
            'is_active': user.is_active, 'guest_id': user.guest_profile.id if user.guest_profile else None,
            'phone': user.guest_profile.phone if user.guest_profile else ''}


def room_view(room):
    return {**columns(room), 'room_type_name': room.room_type.name, 'is_ready': ready(room)}


def reservation_view(r):
    return {**columns(r), 'reference': f'HV-{r.id:05d}', 'guest_name': r.guest.name,
            'guest_email': r.guest.email, 'room_type_name': r.room_type.name,
            'room_number': r.assigned_room.room_number if r.assigned_room else None,
            'room_ready': ready(r.assigned_room) if r.assigned_room else False}


def task_view(t):
    return {**columns(t), 'room_number': t.room.room_number, 'floor': t.room.floor,
            'room_type_name': t.room.room_type.name,
            'assigned_staff_name': t.assigned_staff.name if t.assigned_staff else None}
