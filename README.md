# Haven — Hotel Management System

A full-stack property management system for one hotel, built from the supplied v1 BRD. Haven connects guest reservations, front-desk operations, physical room assignment, checkout, cleaning, and inspection in one workflow.

![Reception workspace](docs/screenshots/dashboard-desktop.jpg)

## Business problem

A reservation does not mean a physical room is ready. Haven separates inventory planning from actual occupancy, cleanliness, and operational availability. It prevents overbooking, preserves booking history and prices, and keeps cleaning separate from reception’s readiness approval.

## Features

- Guest registration, login, logout, profile editing, and access to personal reservations.
- JWT authentication, Argon2 password hashing, server-enforced roles, and disabled-account enforcement.
- Four initial room types, fixed SAR nightly prices, capacity rules, and physical room management.
- Date-based room-type availability, guest and reception bookings, safe changes, cancellation, and manual no-shows.
- Physical room assignment and reassignment before check-in, with overlap protection.
- Check-in restricted to the arrival date, hotel check-in time, and a vacant, inspected room in service.
- Atomic checkout: complete the booking, vacate and dirty the room, and create housekeeping work.
- Task assignment, priorities, start/complete actions, staff notes, and reception inspection.
- Lightweight room-issue reporting and operational status changes.
- Atomic walk-in booking, assignment, and immediate check-in.
- Four role-specific dashboards, search, status filters, confirmations, loading, empty and error states.
- Responsive desktop, tablet, and mobile layouts.

The application contains no payment processing, invoices, dynamic pricing, room transfers, multi-hotel features, or other v1 exclusions.

## User roles

| Role | Main responsibilities |
| --- | --- |
| Admin | Room types, rooms, staff accounts, settings, guest and reservation visibility, operational corrections |
| Receptionist | Reservations, walk-ins, assignment, check-in/out, no-shows, inspection, housekeeping coordination |
| Housekeeping | Assigned tasks only, cleaning, completion notes, relevant room-issue reporting |
| Guest | Own profile, availability, booking, eligible modifications and cancellation, own history |

Housekeeping staff cannot inspect rooms, change operational status, or operate reservations. Admin and reception cannot complete cleaning tasks on behalf of housekeeping. See [business policies](docs/business-policies.md) for exact rules.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS, Lucide icons |
| API | Python 3.12, FastAPI, Pydantic |
| Database | PostgreSQL, SQLAlchemy 2, Alembic |
| Authentication | PyJWT, Argon2 |
| Testing | pytest, FastAPI TestClient; PostgreSQL concurrency integration test |
| Optional local container setup | Docker Compose, PostgreSQL, Python API, Nginx frontend |

Exact verified dependencies are in `frontend/package-lock.json` and `backend/requirements.lock.txt`. `requirements.txt` records the supported direct dependency ranges.

## System architecture

```mermaid
flowchart TD
    Browser[React + TypeScript + Vite] -->|REST / JSON + Bearer JWT| API[FastAPI routes]
    API --> Auth[Authentication and server-side roles]
    API --> Validation[Pydantic input validation]
    API --> Operations[Transactional hotel services]
    Operations --> ORM[SQLAlchemy]
    ORM --> DB[(PostgreSQL)]
    Migrations[Alembic migrations] --> DB
```

Every inventory or operational write obtains the same PostgreSQL `FOR UPDATE` lock on the hotel-settings row. Validation and all related updates remain within the transaction until commit. The single-hotel design intentionally favors straightforward correctness over high write throughput. A PostgreSQL exclusion constraint independently prevents active, overlapping physical room assignments.

## Database ERD

```mermaid
erDiagram
    USER ||--o| GUEST_PROFILE : owns
    GUEST_PROFILE ||--o{ RESERVATION : books
    USER ||--o{ RESERVATION : creates
    ROOM_TYPE ||--o{ ROOM : categorizes
    ROOM_TYPE ||--o{ RESERVATION : reserved_as
    ROOM o|--o{ RESERVATION : assigned_to
    ROOM ||--o{ HOUSEKEEPING_TASK : requires
    RESERVATION o|--o| HOUSEKEEPING_TASK : checkout_creates
    USER o|--o{ HOUSEKEEPING_TASK : assigned_staff
    ROOM ||--o{ ROOM_ISSUE : has
    USER ||--o{ ROOM_ISSUE : reports
    HOTEL_SETTINGS {
        int id PK
        string hotel_name
        time check_in_time
        time check_out_time
    }
    USER {
        int id PK
        string email UK
        string password_hash
        string role
        bool is_active
        int token_version
    }
    GUEST_PROFILE {
        int id PK
        int user_id FK
        string name
        string email
        string phone
    }
    ROOM_TYPE {
        int id PK
        string name UK
        int capacity
        decimal base_price_per_night
        bool is_active
    }
    ROOM {
        int id PK
        string room_number UK
        int room_type_id FK
        string occupancy_status
        string housekeeping_status
        string operational_status
        bool is_active
    }
    RESERVATION {
        int id PK
        int guest_id FK
        int room_type_id FK
        int assigned_room_id FK
        date check_in_date
        date check_out_date
        int guest_count
        int number_of_nights
        decimal price_per_night
        decimal total_stay_cost
        string status
    }
```

See [models.py](backend/app/models.py) and [migrations](backend/alembic/versions) for all fields and constraints.

## Reservation workflow

```mermaid
flowchart LR
    Search[Dates + guest count] --> Availability[Available room types]
    Availability --> Confirm[Confirmed booking + price snapshot]
    Confirm --> Assign[Reception assigns a room]
    Assign --> Ready{Vacant + inspected + in service?}
    Ready -->|Yes, eligible date/time| In[Checked In]
    Ready -->|No| Wait[Reject check-in with an explanation]
    In --> Out[Checked Out]
    Confirm --> Cancel[Cancelled / No-show]
```

Dates are half-open intervals: `[check-in, check-out)`. A departing booking and an arriving booking on the same date do not overlap. Availability subtracts **peak nightly active reservations**, rather than counting every reservation intersecting a multi-night search. Confirmed and checked-in bookings consume inventory.

## Room status and housekeeping workflow

| Dimension | Values |
| --- | --- |
| Occupancy | Vacant, Occupied |
| Housekeeping | Dirty, Clean, Inspected |
| Operational | In Service, Out of Order |

```mermaid
flowchart LR
    Out[Checkout] --> Dirty[Vacant + Dirty / Open task]
    Dirty --> Assign[Reception assigns housekeeping]
    Assign --> Start[Staff starts / In Progress]
    Start --> Complete[Staff completes / Clean]
    Complete --> Inspect[Reception inspects / Inspected]
    Inspect --> Ready[Ready when also Vacant + In Service]
```

Check-in sets occupancy to Occupied. Checkout never makes a room immediately ready. Completed cleaning never automatically marks a room Inspected.

## Quick start with Docker Compose

Requires Docker Engine/Desktop with Compose. Docker is optional; the native setup below was used to verify this delivery.

1. Copy the root `.env.example` to `.env`.
2. Replace both values with unique random secrets. Use URL-safe hexadecimal characters for `POSTGRES_PASSWORD`, since it is embedded in the database URL. Generate each value with `python -c "import secrets; print(secrets.token_hex(32))"`.
3. From the project root, run:

```sh
docker compose up --build -d
docker compose exec api python -m app.seed --demo
```

Open [Haven](http://localhost:8080) and [interactive API documentation](http://localhost:8000/docs). The seed command must run against an empty hotel; it refuses to overwrite existing users or rooms. It generates example stays relative to the day it runs.

For a hotel without sample data, use `docker compose exec api python -m app.create_admin` instead. Migrations create the four initial room types and hotel settings; the admin adds rooms and staff through the UI.

Use `docker compose down` to stop the stack while preserving the database volume. The Compose stack has been provided but was not executed here because Docker is unavailable on this machine.

## Native installation

Prerequisites: Python 3.12+, Node.js 22.12+, npm, PostgreSQL 17 or 18, and optionally Git. This application was verified with Python 3.12, Node.js 24, and PostgreSQL 18 on Windows.

### Database

Create an application role and an empty `hotel` database using your PostgreSQL administration tool. Make the application role the database owner for local development, or have your database administrator enable the `btree_gist` extension before running migrations.

The database URL is `postgresql+psycopg://USER:PASSWORD@HOST:PORT/hotel`. Percent-encode special characters in a password embedded in a URL.

### Backend

From the `backend` directory:

```sh
python -m venv .venv
```

Activate it on Windows PowerShell with `.\.venv\Scripts\Activate.ps1`, or on macOS/Linux with `source .venv/bin/activate`.

```sh
python -m pip install -r requirements.lock.txt
```

Copy `backend/.env.example` to `backend/.env`. Set your `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.

```sh
python -m alembic upgrade head
python -m app.seed --demo
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Use `python -m app.create_admin` instead of seeding for an empty, non-demo hotel. The CLI prompts privately for the initial administrator password. Never seed demo accounts into a public installation.

### Frontend

In a second terminal, from `frontend`:

```sh
npm ci
npm run dev
```

Open [the local app](http://127.0.0.1:5173). Vite proxies `/api` to `http://127.0.0.1:8000`; no frontend secrets are required.

To compile the frontend:

```sh
npm run build
npm run preview
```

The preview also proxies `/api` to the local backend. Keep the backend running. For another host, adjust `vite.config.ts` or configure a reverse proxy as shown in `frontend/nginx.conf`.

## Demo accounts

All seeded demo accounts use **`HavenDemo2026!`**.

| Role | Email |
| --- | --- |
| Admin | `admin@example.com` |
| Receptionist | `reception@example.com` |
| Housekeeping | `housekeeping@example.com` |
| Guest | `guest@example.com` |

These are fictional local demo accounts. Guest registration creates additional guest accounts. Reception-created guest profiles do not automatically create login credentials or send email.

## Environment variables

| Variable | Purpose / default |
| --- | --- |
| `DATABASE_URL` | Required SQLAlchemy PostgreSQL connection URL |
| `JWT_SECRET` | Required secret of at least 32 characters |
| `HOTEL_TIMEZONE` | `Asia/Riyadh`; used for arrival dates and local hotel times |
| `CORS_ORIGINS` | JSON list; defaults to localhost and 127.0.0.1 on port 5173 |
| `ACCESS_TOKEN_MINUTES` | 120; configurable from 5 to 1440 |
| `TEST_DATABASE_URL` | Optional isolated PostgreSQL test DB; name must end in `_test` |
| `POSTGRES_PASSWORD` | Root Compose configuration only |

JWTs are stored in browser session storage. Logout revokes all outstanding JWTs for that account by incrementing its token version. Passwords require 10–128 characters including letters and numbers. `.env` files, database contents, and installed dependencies are excluded from the source archive and Git.

## Database migrations

Run all Alembic commands from `backend` with its environment active.

```sh
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

The initial schema migration creates the eight business entities. Revision `002` installs default settings, the four room types, and PostgreSQL physical-assignment overlap protection. Back up real data before changing schema versions. Use downgrade/upgrade exercises only on disposable test databases.

## Testing

Fast local business-rule checks:

```sh
cd backend
python -m pytest
```

Without `TEST_DATABASE_URL`, the suite uses `hotel_test.db` (SQLite) and skips the PostgreSQL concurrency test. SQLite is only a test convenience; deploy with PostgreSQL.

For the complete suite, create a separate PostgreSQL database named `hotel_test` and set `TEST_DATABASE_URL`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@localhost:5432/hotel_test'
python -m pytest
```

On macOS/Linux, use `export TEST_DATABASE_URL='postgresql+psycopg://USER:PASSWORD@localhost:5432/hotel_test'` before the same pytest command. The suite deletes the contents of its test database between tests and refuses a PostgreSQL database name that does not end in `_test`.

The verified PostgreSQL suite covers registration/login/logout, authorization, price snapshots, invalid input, capacity, overbooking, same-day turnover, safe edits, cancellation, assignment, readiness, check-in/out, housekeeping, issues, walk-ins, dashboards, and simultaneous reservation requests. See [verification notes](docs/verification.md) for the recorded results and browser checks.

## API documentation

- [Swagger UI](http://127.0.0.1:8000/docs) and [ReDoc](http://127.0.0.1:8000/redoc) are served by FastAPI.
- [OpenAPI JSON](docs/openapi.json) is included for offline reference.
- [API guide](docs/api.md) describes endpoint groups, authentication, errors, and request examples.

## Project structure

```text
hotel-management/
├── backend/
│   ├── app/
│   │   ├── main.py          # HTTP routes and permission dependencies
│   │   ├── services.py      # Atomic business operations and inventory rules
│   │   ├── models.py        # SQLAlchemy entities and constraints
│   │   ├── schemas.py       # Validated input contracts
│   │   ├── security.py      # Argon2, JWT, revocation, role enforcement
│   │   ├── presenters.py    # Public response projections
│   │   ├── config.py        # Environment configuration
│   │   ├── db.py            # Session transaction lifecycle
│   │   ├── seed.py          # Explicit demo seed
│   │   └── create_admin.py  # Administrator bootstrap
│   ├── alembic/versions/
│   ├── tests/
│   ├── requirements.txt
│   └── requirements.lock.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Authentication, shell, role-aware routing
│   │   ├── Dashboard.tsx    # Four role dashboards
│   │   ├── Booking.tsx      # Search, book, modify, walk-in
│   │   ├── Reservations.tsx # Lists, details, assignment and transitions
│   │   ├── Operations.tsx  # Room board, housekeeping and issues
│   │   ├── Admin.tsx       # Configuration, guests, staff, profile
│   │   ├── api.ts          # Authenticated API client
│   │   ├── context.tsx     # Session and refresh coordination
│   │   ├── ui.tsx          # Shared UI and data loading primitives
│   │   ├── types.ts        # Shared response types
│   │   └── styles.css      # Responsive visual system
│   └── package-lock.json
├── docs/                    # Policies, API, verification, screenshots, BRD
└── compose.yaml
```

## Screenshots

![Room board](docs/screenshots/room-board-desktop.jpg)

![Guest booking on mobile](docs/screenshots/guest-booking-mobile.jpg)

![Housekeeping on mobile](docs/screenshots/housekeeping-mobile.jpg)

## Scope and future improvements

This is a focused portfolio PMS, with local verification rather than a production hosting rollout. Useful next steps within its scope are an append-only administrative audit log, pagination for large histories, account recovery/email verification, rate limiting at the deployment edge, and production monitoring/backups. Email delivery, password reset, payment processing, billing, reports, external booking integrations, and post-check-in room transfer are not implemented.

Official references used for the implementation: [FastAPI JWT authentication](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [SQLAlchemy SELECT and row locking](https://docs.sqlalchemy.org/en/20/core/selectable.html), and [Vite CLI](https://vite.dev/guide/cli.html).
