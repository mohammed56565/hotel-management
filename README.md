# Haven — Hotel Management System

A full-stack property management system for one hotel. Haven connects guest reservations, front-desk operations, physical room assignment, checkout, cleaning, and inspection in one workflow.

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

The application contains no payment processing, invoices, dynamic pricing, room transfers, or multi-hotel features.

## User roles

| Role | Main responsibilities |
| --- | --- |
| Admin | Room types, rooms, staff accounts, settings, guest and reservation visibility, operational corrections |
| Receptionist | Reservations, walk-ins, assignment, check-in/out, no-shows, inspection, housekeeping coordination |
| Housekeeping | Assigned tasks only, cleaning, completion notes, relevant room-issue reporting |
| Guest | Own profile, availability, booking, eligible modifications and cancellation, own history |

Housekeeping staff cannot inspect rooms, change operational status, or operate reservations. Admin and reception cannot complete cleaning tasks on behalf of housekeeping. See [architecture and hotel workflows](docs/ARCHITECTURE.md) for the detailed rules.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS, Lucide icons |
| API | Python 3.12, FastAPI, Pydantic |
| Database | PostgreSQL, SQLAlchemy 2, Alembic |
| Authentication | PyJWT, Argon2 |
| Testing | pytest, FastAPI TestClient; PostgreSQL concurrency integration test |

Exact verified dependencies are in `frontend/package-lock.json` and `backend/requirements.lock.txt`. `requirements.txt` records the supported direct dependency ranges.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system diagram, database ERD, reservation and housekeeping workflows, permissions, concurrency controls, and detailed source layout.

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

The preview also proxies `/api` to the local backend. Keep the backend running.

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

The verified PostgreSQL suite covers registration/login/logout, authorization, price snapshots, invalid input, capacity, overbooking, same-day turnover, safe edits, cancellation, assignment, readiness, check-in/out, housekeeping, issues, walk-ins, dashboards, and simultaneous reservation requests.

## API documentation

- [Swagger UI](http://127.0.0.1:8000/docs) and [ReDoc](http://127.0.0.1:8000/redoc) are served by FastAPI.
- [OpenAPI schema](http://127.0.0.1:8000/openapi.json) is generated by the running API.

## Project structure

```text
hotel-management/
├── backend/                 # FastAPI, models, migrations, and tests
├── frontend/                # React application and Vite configuration
├── docs/
│   ├── ARCHITECTURE.md       # Design, data model, and hotel workflows
│   └── screenshots/
├── .gitignore
└── README.md
```

## Screenshots

![Room board](docs/screenshots/room-board-desktop.jpg)

![Guest booking on mobile](docs/screenshots/guest-booking-mobile.jpg)

![Housekeeping on mobile](docs/screenshots/housekeeping-mobile.jpg)

## Scope and future improvements

This is a focused portfolio PMS, with local verification rather than a production hosting rollout. Useful next steps within its scope are an append-only administrative audit log, pagination for large histories, account recovery/email verification, rate limiting at the deployment edge, and production monitoring/backups. Email delivery, password reset, payment processing, billing, reports, external booking integrations, and post-check-in room transfer are not implemented.
