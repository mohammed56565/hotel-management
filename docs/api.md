# API guide

Base URL for native local development: `http://127.0.0.1:8000/api`. Vite forwards the same `/api` paths from the frontend origin.

## Authentication

`POST /auth/register` accepts `name`, `email`, and `password`. Role selection is rejected. `POST /auth/login` accepts JSON email/password. Both return `access_token`, `token_type: bearer`, and a safe user projection.

```json
{"email":"reception@example.com","password":"HavenDemo2026!"}
```

Send `Authorization: Bearer <access_token>` for protected endpoints. `GET /auth/me` returns the current user. `POST /auth/logout` increments their token version and revokes all outstanding sessions. `PUT /profile` updates name and optional guest phone. Password hashes and token versions are never exposed by user endpoints.

## Endpoint groups

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /health` | Public | Database connectivity |
| `GET /settings` | Public | Hotel name, times, timezone and current local clock |
| `PUT /settings` | Admin | Change hotel name and standard times |
| `GET, POST /users` | Admin | List safe users / create staff |
| `PUT /users/{id}` | Admin | Staff name and active status |
| `GET /staff/housekeeping` | Front desk | Active housekeeping assignment choices |
| `GET, POST /guests` | Front desk | Search/list guest profiles / create guest |
| `GET /room-types` | Public | Catalog; optional `include_inactive=true` |
| `GET /room-types/{id}` | Public | Room-type details |
| `POST /room-types` | Admin | Create a room type |
| `PUT /room-types/{id}` | Admin | Edit description, price, capacity, active status |
| `GET /availability` | Public | Dates + guest count → bookable room types |
| `GET /rooms` | Front desk | Physical rooms and all three status dimensions |
| `POST /rooms` | Admin | Add room to a type |
| `PUT /rooms/{id}` | Admin | Number, floor, notes, active status |
| `PATCH /rooms/{id}/operational` | Front desk | In Service / Out of Order |
| `POST /rooms/{id}/inspect` | Front desk | Clean → Inspected |
| `GET, POST /reservations` | Guest / front desk | List own/all bookings or create booking |
| `GET, PUT /reservations/{id}` | Guest / front desk | Details or safe modification |
| `POST /reservations/{id}/cancel` | Guest / front desk | Eligible cancellation |
| `POST /reservations/{id}/no-show` | Front desk | Manual no-show |
| `GET /reservations/{id}/rooms` | Front desk | Valid room assignment candidates |
| `POST /reservations/{id}/assign` | Front desk | Assign/reassign physical room |
| `POST /reservations/{id}/check-in` | Front desk | Validate readiness and occupy room |
| `POST /reservations/{id}/check-out` | Front desk | Complete stay and create cleaning task |
| `POST /walk-ins` | Front desk | Atomic booking + assignment + check-in |
| `GET /housekeeping/tasks` | Staff | Own assigned tasks for housekeeping; all for front desk |
| `GET /housekeeping/tasks/{id}` | Staff | Authorized task details |
| `POST /housekeeping/tasks/{id}/assign` | Front desk | Assign staff and priority |
| `POST /housekeeping/tasks/{id}/start` | Assigned housekeeper | Open → In Progress |
| `POST /housekeeping/tasks/{id}/complete` | Assigned housekeeper | In Progress → Completed; room → Clean |
| `GET, POST /issues` | Staff | Authorized issue list / report |
| `POST /issues/{id}/resolve` | Front desk | Resolve an issue |
| `GET /dashboard` | All signed-in users | Role-specific operational/guest data |

“Front desk” means Admin or Receptionist. “Staff” includes Housekeeping, with ownership restrictions. Authorization is enforced on the backend independently from the visible interface.

## Reservation requests

Availability: `GET /availability?check_in_date=2030-10-10&check_out_date=2030-10-13&guest_count=2`.

Guest booking body:

```json
{
  "room_type_id": 1,
  "check_in_date": "2030-10-10",
  "check_out_date": "2030-10-13",
  "guest_count": 2
}
```

Reception adds `guest_id`. The guest’s identity is taken from the authenticated profile; guests cannot book for someone else’s ID. Modification uses the same four stay fields and rejects extra fields such as guest ID or status.

Assignment body: `{"room_id": 1}`. Walk-in body combines the reception booking body and `room_id`; arrival must be today and the room must be ready. Housekeeping assignment: `{"assigned_staff_id": 3, "priority": "High"}`. Cleaning completion: `{"notes": "Fresh linens and surfaces cleaned."}`.

Reservation responses include ID/reference, guest/type, assigned room if any, dates, guest count, nights, snapshotted price, total, state, and lifecycle timestamps. Monetary decimal values should be treated as decimal quantities, whether represented in JSON as strings or numbers by a client.

## Search and filtering

- Reservations: `q`, `status`, `arrival=YYYY-MM-DD`, `departure=YYYY-MM-DD`.
- Guests: `q` searches name/email.
- UI room/task/issue filters operate on the permitted API results.
- Guest result sets are always restricted server-side.

## Error contract

Business failures return `{"detail":"A useful explanation."}`. Pydantic validation returns a `detail` array describing invalid fields.

| Code | Meaning |
| --- | --- |
| 401 | Missing/expired/revoked credentials, disabled user, invalid login |
| 403 | Role does not permit action |
| 404 | Record unavailable, including another guest’s reservation or another housekeeper’s task |
| 409 | Capacity, state-transition, overlapping assignment, or uniqueness conflict |
| 422 | Invalid dates, capacity input, or request fields |
| 503 | Required hotel configuration is missing |

Creation returns 201. Successful reads and transitions return 200. Failed transactions roll back; clients should display the returned explanation and refetch current state before retrying a conflicting operation.

Full request schemas are available in [OpenAPI](openapi.json) and the live `/docs` page.
