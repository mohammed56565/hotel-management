# Verification record

Verified locally on Windows with PostgreSQL 18, Python 3.12, Node.js 24, and the Codex in-app browser. The application uses persisted API/database state; the frontend is not a mock or local-storage simulation.

## Completed checks

| Check | Result |
| --- | --- |
| Backend business-rule and API suite on PostgreSQL | 56 passed |
| Four competing requests for the last room | Exactly one 201; three 409 responses |
| TypeScript compilation | Passed |
| Vite production build | Passed |
| Clean npm install from package-lock.json | Passed |
| Alembic downgrade to base and upgrade to head on isolated hotel_test database | Passed |
| Alembic metadata consistency check | No new upgrade operations detected |
| API health and frontend HTTP response | Passed |
| Live front-desk workflow | Login, reservation detail, check-in, checkout, automatic cleaning-task creation, staff assignment |
| Live housekeeping workflow | Assigned-task visibility, start, completion with notes, Clean status |
| Live inspection workflow | Reception inspection, then Vacant + Inspected + In Service readiness |
| Live guest workflow | Login, date search, selection, creation, modification, new price, cancellation retained in history |
| Live admin interface | Admin-specific navigation, hotel configuration fields, and room-management controls |
| Responsive UI | Desktop, 820-pixel tablet, 390-pixel mobile; no page-width overflow in checked booking/housekeeping views |

The automated suite ran during the initial implementation; the resumed work reused that completed result and added migration, clean-install, and remaining browser checks. Source changes made after it were frontend polish, documentation, demo-account email correction, and deterministic room ordering in the dashboard.

## Automated test coverage

The suite covers valid/invalid/duplicate registration, Argon2 hashes, login failure, disabled users, JWT protection and logout revocation; the role permission matrix and ownership boundaries; valid settings, invalid room types, room uniqueness, fixed-price snapshots, inactive types; dates, capacities, same-day turnover, peak-per-night availability, overbooking; failed edits preserving original data, successful edits clearing assignment, cancellation/no-show release; correct room type, conflicting assignment, check-in date/time and each readiness condition; checkout atomicity and a single generated task; housekeeping ownership and transitions; room issues; out-of-order inventory guards; walk-in rollback and success; all four dashboards; and PostgreSQL concurrency.

## Boundaries

- PostgreSQL was used for the complete suite. The optional SQLite mode cannot verify row locking or PostgreSQL exclusion constraints.
- Docker Compose configuration is supplied, but Docker was not installed here, so container startup was not executed. Native startup and build were verified.
- No public deployment, external account integrations, real guest data, or payment processing were involved.
- Browser checks use fictional seed accounts and leave their sample booking/task history in the local demo database.
- The date input was checked with native keyboard interaction. This browser automation provider’s programmatic date fill did not commit React date state; ordinary native date entry did.
- A full accessibility audit and production load/security review are not claimed. Focus labels, dialog naming, mobile navigation visibility, and responsive layout received targeted checks.

## Recorded screenshots

- `screenshots/dashboard-desktop.jpg`
- `screenshots/room-board-desktop.jpg`
- `screenshots/guest-booking-mobile.jpg`
- `screenshots/housekeeping-mobile.jpg`

Each screenshot is from the running application with persisted local data.
