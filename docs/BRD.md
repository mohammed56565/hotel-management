# Business Requirements Document (BRD)
# Hotel Management System

**Version:** 1.0  
**Document Status:** Approved Development Baseline  
**Project Type:** Full-Stack Hotel Property Management System  
**Primary Interface Language:** English  
**Target:** Single-hotel operations  
**System Type:** Simplified Hotel PMS

---

# 1. Executive Summary

The Hotel Management System is a full-stack web application designed to manage the core operational activities of a single hotel.

The system focuses on:

- Room Types
- Rooms
- Guest Reservations
- Room Availability
- Room Assignment
- Check-in
- Check-out
- Housekeeping
- Walk-in Guests
- Reservation Modification
- Cancellation
- No-show Handling
- Room Operational Status

The system is intended to resemble the workflow of real hotel Property Management Systems while remaining appropriately scoped for a portfolio project.

The application must provide clear operational workflows instead of functioning as a basic room-reservation CRUD application.

The core business flow is:

```text
Guest searches Room Types
        ↓
Selects available Room Type
        ↓
Creates Reservation
        ↓
Hotel assigns actual Room Number
        ↓
Room is verified as ready
        ↓
Guest Checks In
        ↓
Room becomes Occupied
        ↓
Guest Checks Out
        ↓
Room becomes Vacant + Dirty
        ↓
Housekeeping cleans room
        ↓
Receptionist inspects room
        ↓
Room becomes ready again
```

---

# 2. Business Objectives

The system aims to:

1. Allow Guests to search available room types.
2. Allow Guests to create their own reservations.
3. Allow Receptionists to create reservations on behalf of Guests.
4. Support walk-in Guests.
5. Prevent reservation overbooking.
6. Prevent invalid overlapping reservations.
7. Allow the hotel to assign the actual Room Number.
8. Manage Check-in and Check-out.
9. Track Room Occupancy separately from Room Cleanliness.
10. Track operational availability separately from Occupancy.
11. Support Housekeeping cleaning tasks.
12. Allow Receptionists to inspect cleaned rooms.
13. Allow Guests to modify future reservations.
14. Allow Guests to cancel eligible reservations.
15. Allow Receptionists to mark No-shows.
16. Calculate stay cost using a fixed Room Type nightly price.
17. Provide role-based access control.
18. Provide a realistic but focused Hotel PMS workflow.

---

# 3. Project Scope

## 3.1 In Scope

Version 1 includes:

### Authentication

- Guest registration
- User Login
- User Logout
- JWT Authentication
- Password hashing
- Role-based authorization

### User Roles

- Admin
- Receptionist
- Housekeeping Staff
- Guest

### Room Types

- Standard King
- Standard Twin
- Deluxe King
- Suite

### Room Management

- Individual Room Numbers
- Room Type Assignment
- Occupancy Status
- Housekeeping Status
- Operational Status

### Reservations

- Guest self-service reservations
- Receptionist-created reservations
- Walk-in reservations
- Availability checking
- Reservation modification
- Reservation cancellation
- No-show handling

### Hotel Operations

- Room assignment
- Check-in
- Check-out
- Housekeeping tasks
- Room inspection

### Pricing

- Fixed Base Price per Night
- Stay cost calculation

### Dashboard

- Operational Room Summary
- Today's Arrivals
- Today's Departures
- Cleaning / Inspection Status

---

# 4. Out of Scope

Version 1 does not include:

- Online Payment Gateway
- Payment Processing
- Invoices
- Accounting
- Dynamic Pricing
- Seasonal Pricing
- Weekend Pricing
- Discount Codes
- Loyalty Program
- Restaurant Management
- Room Service
- Breakfast Orders
- Laundry Services
- Airport Pickup
- Additional Guest Services
- Inventory Management
- Hotel Maintenance Management
- Employee HR
- Payroll
- Booking.com Integration
- Expedia Integration
- External Travel Platform Integration
- Smart Door Locks
- IoT
- AI Features
- Chatbot
- Reports Module
- PDF Export
- CSV Export
- Excel Export
- Multi-Hotel Management
- Multi-Branch Management
- Room Transfer after Check-in
- Overbooking
- Early Check-in
- Late Check-out
- Native Mobile Application
- Dark Mode

---

# 5. Hotel Operating Model

Version 1 manages one hotel.

The hotel has:

- One configurable Check-in Time
- One configurable Check-out Time
- Multiple Room Types
- Multiple physical Rooms
- Multiple Receptionists
- Multiple Housekeeping Staff
- Multiple Guests

Default hotel times:

```text
Standard Check-in Time: 3:00 PM
Standard Check-out Time: 12:00 PM
```

These values must be configurable by Admin.

---

# 6. User Roles

The system includes:

```text
Admin
Receptionist
Housekeeping Staff
Guest
```

---

# 7. Admin

Admin can:

- Manage Receptionist accounts
- Manage Housekeeping Staff accounts
- Manage Room Types
- Manage Rooms
- Manage Hotel Settings
- Set Check-in Time
- Set Check-out Time
- View all Reservations
- View all Guests
- View all Housekeeping Tasks
- Change Room Operational Status
- Access the Admin Dashboard
- Perform administrative corrections when necessary

Admin is responsible for system configuration rather than normal daily front-desk operations.

---

# 8. Receptionist

Receptionist is the primary hotel operations user.

Receptionist can:

- View reservations
- Create reservation for Guest
- Create walk-in reservation
- Search Room Type availability
- Assign Room Number
- Change Room Assignment before Check-in
- Check Guest in
- Check Guest out
- Cancel eligible reservations
- Mark reservation as No-show
- View Guest information
- View Room statuses
- Mark Room as Inspected
- Change Room Operational Status where authorized
- View Housekeeping progress
- View Today's Arrivals
- View Today's Departures

Receptionist cannot manage Admin accounts or core system configuration.

---

# 9. Housekeeping Staff

Housekeeping Staff can:

- View assigned Housekeeping Tasks
- View Room Number
- View Task Priority
- Start Cleaning
- Complete Cleaning
- View their completed cleaning tasks
- Report room issues
- View relevant Room housekeeping information

Housekeeping Staff cannot:

- Create Reservations
- Assign Rooms
- Check Guests in
- Check Guests out
- Mark Rooms as Inspected
- Change Room Operational Status directly
- Manage Room Types
- Manage Guests

---

# 10. Guest

Guest can:

- Register
- Login
- Manage basic profile information
- Search Room Type availability
- View Room Type information
- Create Reservation
- View own Reservations
- Modify eligible future Reservation
- Cancel eligible future Reservation
- View Reservation Details
- View calculated stay cost

Guest does not select the physical Room Number.

---

# 11. Permission Matrix

| Action | Admin | Receptionist | Housekeeping | Guest |
|---|---|---|---|---|
| Manage Users | Yes | No | No | No |
| Manage Room Types | Yes | No | No | No |
| Manage Rooms | Yes | Limited | No | No |
| Search Availability | Yes | Yes | No | Yes |
| Create Reservation | Yes | Yes | No | Yes |
| Create Walk-in | Yes | Yes | No | No |
| Modify Own Reservation | N/A | Yes | No | Yes |
| Cancel Reservation | Yes | Yes | No | Own Only |
| Assign Room | Yes | Yes | No | No |
| Check-in | Yes | Yes | No | No |
| Check-out | Yes | Yes | No | No |
| Mark No-show | Yes | Yes | No | No |
| View Cleaning Tasks | Yes | Yes | Yes | No |
| Start Cleaning | No | No | Yes | No |
| Complete Cleaning | No | No | Yes | No |
| Mark Inspected | Yes | Yes | No | No |
| Change Operational Status | Yes | Limited | No | No |

Backend authorization must enforce all permissions.

Frontend visibility alone must not be treated as a security mechanism.

---

# 12. Guest Registration

## FR01 – Guest Registration

Guests may register themselves.

Required information:

- Full Name
- Email
- Password

### Acceptance Criteria

- Email must be valid.
- Email must be unique.
- Password must meet minimum security requirements.
- Guest role is assigned automatically.
- User cannot select their own Role.

---

# 13. Room Types

Version 1 begins with four Room Types:

```text
Standard King
Standard Twin
Deluxe King
Suite
```

Each Room Type contains:

```text
Name
Description
Capacity
Base Price Per Night
Active Status
```

---

# 14. Room Type Capacity

Each Room Type has one general:

```text
Capacity
```

Example:

```text
Standard King
Capacity: 2 Guests

Suite
Capacity: 4 Guests
```

The system does not separate:

- Max Adults
- Max Children

in Version 1.

---

# 15. Room Type Pricing

Each Room Type has one fixed:

```text
Base Price Per Night
```

Example:

```text
Standard King
450 SAR / Night
```

The price does not change based on:

- Day of Week
- Season
- Demand
- Holidays
- Occupancy Rate

Dynamic Pricing is outside Version 1.

---

# 16. Individual Rooms

A physical Room belongs to one Room Type.

Example:

```text
Room 101 → Standard King
Room 102 → Standard Twin
Room 201 → Deluxe King
Room 301 → Suite
```

Suggested Room fields:

```text
Room Number
Room Type
Floor
Notes
```

Room Number must be unique.

---

# 17. Room Status Model

Room status must not be represented by one combined status.

The system must track three independent status dimensions:

1. Occupancy Status
2. Housekeeping Status
3. Operational Status

---

# 18. Occupancy Status

Occupancy Status indicates whether a Guest is physically occupying the Room.

Values:

```text
Vacant
Occupied
```

---

# 19. Housekeeping Status

Housekeeping Status indicates the cleanliness/readiness of the Room.

Values:

```text
Dirty
Clean
Inspected
```

### Meaning

**Dirty**

Room requires cleaning.

**Clean**

Housekeeping Staff completed cleaning.

**Inspected**

Receptionist verified the cleaned Room and approved it for Guest use.

---

# 20. Operational Status

Operational Status indicates whether the Room can be used operationally.

Values:

```text
In Service
Out of Order
```

A Room marked:

```text
Out of Order
```

must not be assigned for Guest Check-in.

---

# 21. Ready Room Definition

A physical Room is considered ready for Guest Check-in only when:

```text
Occupancy = Vacant
Housekeeping = Inspected
Operational = In Service
```

All three conditions are required.

---

# 22. Reservation Statuses

Version 1 uses:

```text
Confirmed
Checked In
Checked Out
Cancelled
No-show
```

There is no:

```text
Pending
```

status in Version 1.

---

# 23. Guest Reservation Process

Standard Guest reservation flow:

```text
Guest selects Check-in Date
        ↓
Guest selects Check-out Date
        ↓
Guest enters Number of Guests
        ↓
System checks Room Type availability
        ↓
Guest selects Room Type
        ↓
System calculates Total Stay Cost
        ↓
Guest confirms
        ↓
Reservation = Confirmed
```

Guest does not select Room Number.

---

# 24. Reservation Information

Each Reservation should contain:

- Reservation ID
- Guest
- Room Type
- Assigned Room
- Check-in Date
- Check-out Date
- Number of Guests
- Number of Nights
- Base Price Per Night
- Total Stay Cost
- Status
- Created At
- Updated At

Assigned Room may initially be empty.

---

# 25. Date-Based Booking

Reservations are based on:

```text
Check-in Date
Check-out Date
```

rather than arbitrary hourly booking.

Example:

```text
Check-in: October 10
Check-out: October 13
```

This represents:

```text
3 Nights
```

---

# 26. Standard Check-in and Check-out Time

The Hotel Settings define:

```text
Check-in Time
Check-out Time
```

Initial configuration:

```text
Check-in: 3:00 PM
Check-out: 12:00 PM
```

These times apply to all standard reservations in Version 1.

---

# 27. Same-Day Turnover

A Room may support:

```text
Guest A:
Oct 10 → Oct 13

Guest B:
Oct 13 → Oct 16
```

This is valid.

Operational flow:

```text
Guest A Checks Out by 12:00 PM
        ↓
Room becomes Vacant + Dirty
        ↓
Housekeeping cleans
        ↓
Receptionist inspects
        ↓
Guest B Checks In from 3:00 PM
```

---

# 28. Reservation Overlap Rule

Reservations conflict when their stay dates overlap.

Example:

Existing:

```text
Oct 10 → Oct 13
```

Invalid competing reservation:

```text
Oct 12 → Oct 15
```

Same-day turnover is not considered an overlap:

```text
Oct 10 → Oct 13
Oct 13 → Oct 15
```

is valid.

---

# 29. No Overbooking Rule

Overbooking is prohibited.

If a Room Type has:

```text
10 Rooms
```

the system must not create more than:

```text
10 overlapping active reservations
```

for that Room Type.

Reservations with statuses that consume availability include:

```text
Confirmed
Checked In
```

Cancelled and No-show reservations do not consume future Room Type availability.

---

# 30. Availability Calculation

Room Type availability must consider:

- Total active Rooms of the Room Type
- Reservation date overlap
- Confirmed Reservations
- Checked-in Reservations
- Rooms permanently unavailable where appropriate
- Guest count versus Room Type Capacity

The system must never rely only on the frontend to determine availability.

Backend validation is mandatory.

---

# 31. Capacity Rule

A Reservation cannot exceed Room Type Capacity.

Example:

```text
Room Type Capacity: 2
Guests Requested: 4
```

Result:

```text
Reservation rejected
```

---

# 32. Stay Cost Calculation

Total Stay Cost:

```text
Base Price Per Night × Number of Nights
```

Example:

```text
Base Price = 500 SAR
Stay = 3 Nights

Total Stay Cost = 1,500 SAR
```

This is an informational booking cost.

No Payment Gateway is included.

---

# 33. Room Assignment

Guest reserves:

```text
Room Type
```

not:

```text
Room Number
```

Receptionist assigns an actual Room.

Example:

```text
Guest booked:
Deluxe King

Receptionist assigns:
Room 204
```

---

# 34. Room Assignment Timing

Room Assignment may happen before arrival.

However:

> A physical Room must be assigned before Check-in can succeed.

Receptionist may change the assigned Room before Check-in.

---

# 35. Room Assignment Rules

The Room selected must:

1. Belong to the Reservation's Room Type.
2. Not be assigned to another conflicting Reservation.
3. Be operationally valid.
4. Be able to become ready before Check-in.

At the actual Check-in moment, it must be:

```text
Vacant
Inspected
In Service
```

---

# 36. Reservation Modification

Guest may modify their own future Confirmed Reservation before Check-in.

Supported modifications:

- Check-in Date
- Check-out Date
- Room Type
- Number of Guests

---

# 37. Safe Reservation Modification

Modification must not destroy the original Reservation before the new selection is validated.

Flow:

```text
Existing Reservation
        ↓
Guest requests changes
        ↓
System checks Availability
        ↓
System checks Capacity
        ↓
System recalculates Price
        ↓
If valid → Apply Changes
If invalid → Keep Original Reservation
```

The existing booking remains unchanged if modification fails.

---

# 38. Assigned Room after Modification

If a modification changes:

- Room Type
- Check-in Date
- Check-out Date

the existing Room Assignment may become invalid.

The system should clear the physical Room Assignment where appropriate and require Receptionist to assign a valid Room again.

---

# 39. Reservation Cancellation

Guest may cancel their own future:

```text
Confirmed
```

Reservation before Check-in.

Version 1 has:

- No cancellation fee
- No refund logic
- No payment logic

Cancelled Reservation remains in history.

---

# 40. No-show

No-show is not automatic.

Receptionist manually marks a Confirmed Reservation as:

```text
No-show
```

when the Guest does not arrive according to hotel operational policy.

The system must preserve the Reservation history.

---

# 41. Check-in

Receptionist performs Check-in.

Before Check-in, the system must validate:

- Reservation Status = Confirmed
- Current date matches eligible arrival date
- Physical Room is assigned
- Room belongs to required Room Type
- Occupancy = Vacant
- Housekeeping = Inspected
- Operational = In Service

---

# 42. Check-in Result

Successful Check-in changes:

```text
Reservation:
Confirmed → Checked In
```

and:

```text
Room Occupancy:
Vacant → Occupied
```

Housekeeping Status remains independently tracked.

---

# 43. Check-out

Receptionist performs Check-out.

Successful Check-out changes:

```text
Reservation:
Checked In → Checked Out
```

and:

```text
Room Occupancy:
Occupied → Vacant
```

The Room must then become:

```text
Housekeeping Status:
Dirty
```

---

# 44. Post Check-out Rule

Check-out must not immediately make the Room ready for another Guest.

After Check-out:

```text
Occupancy: Vacant
Housekeeping: Dirty
Operational: In Service
```

The Room requires Housekeeping processing.

---

# 45. Housekeeping Task Creation

When Check-out occurs, the system creates a Housekeeping Task for the Room.

Suggested Task data:

- Task ID
- Room
- Assigned Housekeeping Staff
- Status
- Priority
- Created At
- Started At
- Completed At
- Notes

---

# 46. Housekeeping Task Statuses

Version 1 uses:

```text
Open
In Progress
Completed
```

---

# 47. Housekeeping Workflow

```text
Check-out
↓
Room = Vacant + Dirty
↓
Housekeeping Task = Open
↓
Staff starts cleaning
↓
Task = In Progress
↓
Staff completes cleaning
↓
Task = Completed
Room = Clean
↓
Receptionist inspects
↓
Room = Inspected
```

---

# 48. Housekeeping Staff Responsibilities

Housekeeping Staff can:

- View assigned Open Tasks
- Start Task
- Complete Task
- Add cleaning notes
- Report Room Issue

Completing a Task changes:

```text
Housekeeping Status:
Dirty → Clean
```

It does not change the Room to Inspected.

---

# 49. Room Inspection

Receptionist is responsible for inspection.

Receptionist can change:

```text
Clean → Inspected
```

after verifying the Room is ready.

This deliberately separates:

```text
Cleaning
```

from:

```text
Final readiness approval
```

---

# 50. Room Issue Reporting

Housekeeping Staff may report Room problems such as:

- Air conditioning issue
- Broken light
- Bathroom issue
- Furniture damage

Version 1 does not include a complete Maintenance Management module.

A reported issue may lead Admin or Receptionist to mark:

```text
Operational Status:
Out of Order
```

---

# 51. Out of Order Room

An Out of Order Room:

- Cannot be assigned for Check-in.
- Must not be considered ready.
- Remains visible to hotel staff.
- May later return to In Service.

Operational Status is independent from cleanliness.

Example:

```text
Vacant
Clean
Out of Order
```

is possible.

---

# 52. Ideal Operating Assumption

Version 1 assumes the hotel operates under the normal intended workflow.

The system does not handle complex post Check-in emergency scenarios such as:

- Guest Room Transfer
- Mid-stay Room Replacement
- Emergency Maintenance Relocation

The hotel must ensure the assigned Room is ready before Check-in.

---

# 53. Walk-in Guest

Receptionist may handle a Guest without an existing reservation.

Flow:

```text
Guest arrives
↓
Receptionist searches current availability
↓
Selects Room Type
↓
Creates Guest / Reservation
↓
Assigns ready Room
↓
Performs Check-in
```

All normal:

- Capacity
- Availability
- Pricing
- Room readiness

rules still apply.

---

# 54. Guest Search

Guest should be able to search using:

```text
Check-in Date
Check-out Date
Number of Guests
```

System returns available Room Types.

Suggested display:

```text
Standard King
Capacity: 2
450 SAR / Night
Available

Deluxe King
Capacity: 2
600 SAR / Night
Available
```

---

# 55. Guest Reservation Dashboard

Guest Dashboard should include:

- Upcoming Reservation
- Current Stay if Checked In
- Past Reservations
- Cancelled Reservations

Guest can open Reservation details and perform allowed actions.

---

# 56. Receptionist Dashboard

Receptionist Dashboard should focus on daily operations.

Suggested information:

- Today's Arrivals
- Today's Departures
- Guests Currently Checked In
- Rooms Awaiting Inspection
- Vacant Ready Rooms
- Rooms Out of Order

---

# 57. Admin Dashboard

Admin Dashboard may display:

- Total Rooms
- Occupied Rooms
- Vacant Rooms
- Out of Order Rooms
- Dirty Rooms
- Clean Rooms
- Inspected Rooms
- Today's Check-ins
- Today's Check-outs

No advanced analytics module is required.

---

# 58. Housekeeping Dashboard

Housekeeping Staff should see:

- Assigned Open Tasks
- In Progress Tasks
- Priority Tasks
- Completed Tasks

Each task should clearly display:

```text
Room Number
Task Status
Priority
Notes
```

---

# 59. Main Application Pages

Suggested routes:

```text
/login
/register

/rooms/search
/room-types/:id

/my-reservations
/my-reservations/:id

/reception/dashboard
/reception/reservations
/reception/reservations/:id
/reception/arrivals
/reception/departures
/reception/rooms

/housekeeping/dashboard
/housekeeping/tasks
/housekeeping/tasks/:id

/admin/dashboard
/admin/users
/admin/rooms
/admin/room-types
/admin/settings

/profile
```

Exact naming may vary during implementation.

---

# 60. Loading States

Data-driven pages must display loading feedback.

Examples:

```text
Searching available rooms...
```

```text
Loading reservation...
```

```text
Loading housekeeping tasks...
```

---

# 61. Empty States

Examples:

```text
No rooms are available for these dates.
```

```text
You have no upcoming reservations.
```

```text
No rooms are currently awaiting inspection.
```

```text
No housekeeping tasks are assigned to you.
```

---

# 62. Error States

Examples:

```text
This Room Type is no longer available for the selected dates.
```

```text
The assigned room is not ready for check-in.
```

```text
Guest count exceeds Room Type capacity.
```

```text
You do not have permission to perform this action.
```

---

# 63. Confirmation Dialogs

Confirmation should be required for actions such as:

- Cancel Reservation
- Mark No-show
- Check-out
- Mark Room Out of Order
- Significant reservation modification

---

# 64. Toast Feedback

Examples:

```text
Reservation created successfully.
```

```text
Reservation updated successfully.
```

```text
Guest checked in successfully.
```

```text
Guest checked out successfully.
```

```text
Cleaning task completed.
```

```text
Room marked as inspected.
```

---

# 65. Responsive Design

Application must support:

- Desktop
- Tablet
- Mobile

Guest reservation pages should work comfortably on Mobile.

Reception and Admin interfaces may be primarily optimized for Desktop while remaining responsive.

Housekeeping screens should work well on Tablet and Mobile.

---

# 66. Main Data Entities

Primary entities:

```text
User
GuestProfile
HotelSettings
RoomType
Room
Reservation
HousekeepingTask
RoomIssue
```

Supporting entities may be introduced where necessary.

---

# 67. User Entity

Suggested fields:

```text
id
name
email
password_hash
role
is_active
created_at
updated_at
```

---

# 68. Hotel Settings Entity

Suggested fields:

```text
id
hotel_name
check_in_time
check_out_time
updated_at
```

---

# 69. Room Type Entity

Suggested fields:

```text
id
name
description
capacity
base_price_per_night
is_active
created_at
updated_at
```

---

# 70. Room Entity

Suggested fields:

```text
id
room_number
room_type_id
floor
occupancy_status
housekeeping_status
operational_status
notes
created_at
updated_at
```

---

# 71. Reservation Entity

Suggested fields:

```text
id
guest_id
room_type_id
assigned_room_id
check_in_date
check_out_date
guest_count
number_of_nights
price_per_night
total_stay_cost
status
created_by
created_at
updated_at
checked_in_at
checked_out_at
cancelled_at
```

---

# 72. Housekeeping Task Entity

Suggested fields:

```text
id
room_id
assigned_staff_id
status
priority
notes
created_at
started_at
completed_at
```

---

# 73. Room Issue Entity

Suggested fields:

```text
id
room_id
reported_by
description
status
reported_at
resolved_at
```

The Room Issue feature remains intentionally lightweight.

---

# 74. Reservation Integrity Rules

The following rules are mandatory:

1. Check-out Date must be after Check-in Date.
2. Guest Count must be greater than zero.
3. Guest Count must not exceed Room Type Capacity.
4. Room Type must be active.
5. No overbooking is allowed.
6. Same-day turnover is allowed.
7. Overlapping reservations must respect Room Type inventory.
8. Guest cannot modify a Checked In reservation.
9. Guest cannot modify a Checked Out reservation.
10. Guest cannot cancel a Checked In reservation.
11. Guest cannot cancel another Guest's reservation.
12. Assigned Room must belong to the Reservation's Room Type.
13. Assigned Room must not conflict with another Reservation.
14. Check-in requires a ready physical Room.
15. Check-out automatically creates Housekeeping work.

---

# 75. Room Readiness Rules

Check-in can occur only when:

```text
Room Occupancy = Vacant
AND
Housekeeping = Inspected
AND
Operational = In Service
```

If any condition fails:

```text
Check-in must be rejected
```

---

# 76. Reservation Modification Integrity

When Guest modifies Reservation:

```text
New Dates
New Room Type
New Guest Count
```

the system must validate all new conditions before committing changes.

Failure must leave the original Reservation unchanged.

---

# 77. Pricing Integrity

The Reservation should store the price used when the Reservation was confirmed.

Example:

```text
Room Type current Base Price: 500 SAR
Reservation created at: 450 SAR
```

A later Admin price change must not silently alter historical Reservation totals.

---

# 78. Technical Stack

## Frontend

```text
React
TypeScript
Vite
React Router
Tailwind CSS
```

---

# 79. Backend

```text
Python
FastAPI
Pydantic
```

FastAPI handles:

- REST API
- Authentication
- Authorization
- Business Logic
- Reservation validation
- Availability
- Check-in / Check-out
- Housekeeping workflows

Pydantic handles request and response validation.

---

# 80. Database

```text
PostgreSQL
```

PostgreSQL stores all persistent application data.

---

# 81. ORM

```text
SQLAlchemy
```

SQLAlchemy manages database access and entity relationships.

---

# 82. Database Migrations

```text
Alembic
```

Alembic manages database schema migrations.

---

# 83. Authentication

Authentication uses:

```text
JWT
```

Users login with:

```text
Email
Password
```

Passwords must be hashed using:

```text
Argon2
```

---

# 84. Testing

Backend testing uses:

```text
pytest
FastAPI TestClient
```

Testing must focus heavily on Business Rules.

---

# 85. Package Management

Backend:

```text
pip
requirements.txt
```

Frontend:

```text
npm
package.json
```

---

# 86. Version Control

```text
Git
GitHub
```

---

# 87. System Architecture

```text
React + TypeScript + Vite
          │
          │ REST API / JSON
          ↓
       FastAPI
          ↓
       Pydantic
          ↓
      SQLAlchemy
          ↓
      PostgreSQL
```

Alembic manages database migrations.

---

# 88. Suggested Backend Structure

Recommended logical modules:

```text
auth
users
guests
room_types
rooms
reservations
housekeeping
hotel_settings
dashboard
```

Exact implementation may vary.

---

# 89. Suggested Frontend Structure

```text
pages
components
features
api
auth
hooks
types
utils
```

Reusable components should be used where appropriate.

---

# 90. Security Requirements

The application must:

- Hash passwords using Argon2
- Authenticate protected endpoints
- Enforce roles on Backend
- Validate all API input
- Prevent Guest access to other Guest reservations
- Prevent Housekeeping access to Reception operations
- Prevent unauthorized Room configuration
- Protect JWT secret
- Protect database credentials
- Use environment variables for secrets

---

# 91. Required Automated Tests

## Authentication

- Guest Registration
- Duplicate Email Rejected
- Valid Login
- Invalid Login
- Disabled User Cannot Login
- Protected Route Without JWT

## Authorization

- Guest Cannot Access Admin
- Guest Cannot Check-in Reservation
- Housekeeping Cannot Create Reservation
- Housekeeping Cannot Mark Inspected
- Guest Cannot Modify Another Guest Reservation

## Room Types

- Create Room Type
- Invalid Capacity Rejected
- Invalid Price Rejected
- Inactive Room Type Cannot Be Newly Booked

## Rooms

- Duplicate Room Number Rejected
- Room Statuses Stored Independently
- Out of Order Room Cannot Be Used for Check-in

## Availability

- Available Room Type Returned
- Overlapping Capacity Correctly Reduced
- Same-Day Turnover Allowed
- Overbooking Prevented
- Guest Capacity Enforced

## Reservations

- Guest Can Create Reservation
- Receptionist Can Create Reservation
- Invalid Date Range Rejected
- Price Calculation Correct
- Reservation Snapshot Price Preserved

## Reservation Modification

- Guest Can Modify Future Confirmed Reservation
- Availability Rechecked
- Capacity Rechecked
- Invalid Modification Leaves Original Reservation Unchanged

## Cancellation

- Guest Can Cancel Own Confirmed Reservation
- Guest Cannot Cancel Other Reservation
- Checked-in Reservation Cannot Be Cancelled

## Room Assignment

- Assigned Room Matches Room Type
- Conflicting Room Assignment Rejected
- Room Must Be Assigned Before Check-in

## Check-in

- Confirmed → Checked In
- Room Vacant → Occupied
- Dirty Room Rejects Check-in
- Clean but Not Inspected Room Rejects Check-in
- Out of Order Room Rejects Check-in

## Check-out

- Checked In → Checked Out
- Room Occupied → Vacant
- Room Becomes Dirty
- Housekeeping Task Automatically Created

## Housekeeping

- Staff Can Start Assigned Task
- Staff Can Complete Assigned Task
- Completed Cleaning Sets Room Clean
- Cleaning Does Not Automatically Set Inspected
- Receptionist Can Mark Clean Room Inspected

## No-show

- Receptionist Can Mark Confirmed Reservation No-show
- Guest Cannot Mark No-show

## Walk-in

- Receptionist Can Create Walk-in Reservation
- Availability Still Enforced
- Ready Room Required Before Immediate Check-in

---

# 92. Development Phases

## Phase 1 – Project Setup

- Git repository
- React + TypeScript
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Environment configuration

## Phase 2 – Authentication

- User Model
- Guest Registration
- Login
- JWT
- Argon2
- Role Permissions

## Phase 3 – Hotel Configuration

- Hotel Settings
- Check-in Time
- Check-out Time
- Room Types

## Phase 4 – Room Management

- Rooms
- Occupancy Status
- Housekeeping Status
- Operational Status

## Phase 5 – Guest Reservations

- Availability Search
- Reservation Creation
- Price Calculation
- No Overbooking
- Guest Capacity

## Phase 6 – Reservation Management

- Guest Reservation History
- Reservation Modification
- Cancellation
- No-show

## Phase 7 – Room Assignment

- Physical Room Assignment
- Reassignment before Check-in
- Conflict Validation

## Phase 8 – Check-in / Check-out

- Readiness Validation
- Check-in
- Check-out
- Occupancy Updates

## Phase 9 – Housekeeping

- Task Creation
- Assignment
- Cleaning Workflow
- Room Inspection
- Basic Room Issue Reporting

## Phase 10 – Walk-ins

- Front Desk Reservation
- Immediate Assignment
- Immediate Check-in

## Phase 11 – Dashboards

- Guest Dashboard
- Receptionist Dashboard
- Housekeeping Dashboard
- Admin Dashboard

## Phase 12 – UI Completion

- Responsive Design
- Search
- Filters
- Loading States
- Empty States
- Error States
- Confirmation Dialogs
- Toast Feedback

## Phase 13 – Testing

- Authentication
- Authorization
- Availability
- Reservation
- Housekeeping
- Check-in / Check-out
- No Overbooking

## Phase 14 – Documentation

- README
- ERD
- Architecture
- API Documentation
- Screenshots
- Setup Guide

---

# 93. GitHub README Requirements

Final README should include:

1. Project Title
2. Project Overview
3. Business Problem
4. Core Features
5. User Roles
6. Technology Stack
7. System Architecture
8. Database ERD
9. Reservation Workflow
10. Room Status Model
11. Check-in / Check-out Workflow
12. Housekeeping Workflow
13. Installation Instructions
14. Environment Variables
15. Backend Setup
16. Frontend Setup
17. Database Migration Instructions
18. Testing Instructions
19. Screenshots
20. Project Structure
21. Future Improvements

---

# 94. Recommended Screenshots

README should ideally contain:

- Guest Login / Register
- Room Availability Search
- Room Type Selection
- Reservation Confirmation
- Guest Reservations
- Receptionist Dashboard
- Today's Arrivals
- Reservation Details
- Room Assignment
- Check-in Screen
- Check-out Screen
- Room Status Board
- Housekeeping Dashboard
- Cleaning Task
- Room Inspection
- Admin Room Type Management

---

# 95. Final Deliverables

The completed project should include:

- React TypeScript Frontend
- FastAPI Backend
- PostgreSQL
- SQLAlchemy
- Alembic
- JWT Authentication
- Argon2 Password Hashing
- Role-Based Authorization
- Guest Registration
- Room Type Management
- Room Management
- Room Availability
- Reservation Booking
- No Overbooking
- Reservation Modification
- Cancellation
- No-show
- Room Assignment
- Check-in
- Check-out
- Walk-in Booking
- Housekeeping Tasks
- Room Inspection
- Room Operational Status
- Pricing Calculation
- Dashboards
- Search / Filters
- Responsive UI
- Automated Tests
- README
- ERD
- API Documentation

---

# 96. Final Acceptance Criteria

Version 1 is complete when:

1. Guests can register.
2. Users can login securely.
3. Role permissions work correctly.
4. Admin can manage Room Types.
5. Admin can manage Rooms.
6. Hotel Check-in / Check-out times are configurable.
7. Four initial Room Types exist.
8. Room Type Capacity is enforced.
9. Base Price Per Night is stored.
10. Room status is separated into three dimensions.
11. Guest can search available Room Types.
12. Guest can create Reservation.
13. Receptionist can create Reservation.
14. Overbooking is prevented.
15. Same-day Room turnover is allowed.
16. Overlapping Reservation logic works correctly.
17. Number of Nights is calculated correctly.
18. Total Stay Cost is calculated correctly.
19. Historical Reservation price is preserved.
20. Guest does not select Room Number.
21. Receptionist can assign Room.
22. Receptionist can change Room before Check-in.
23. Assigned Room must match Room Type.
24. Guest can modify future Confirmed Reservation.
25. Invalid modification preserves original Reservation.
26. Guest can cancel eligible future Reservation.
27. Receptionist can mark No-show.
28. Check-in requires assigned Room.
29. Check-in requires Vacant Room.
30. Check-in requires Inspected Room.
31. Check-in requires In Service Room.
32. Check-in changes Occupancy to Occupied.
33. Check-out changes Occupancy to Vacant.
34. Check-out changes Housekeeping to Dirty.
35. Check-out creates Housekeeping Task.
36. Housekeeping Staff can start cleaning.
37. Housekeeping Staff can complete cleaning.
38. Cleaning changes Room to Clean.
39. Cleaning does not automatically mark Room Inspected.
40. Receptionist can mark Clean Room Inspected.
41. Out of Order Rooms cannot be used for Check-in.
42. Housekeeping Staff can report a Room Issue.
43. Walk-in Guest workflow works.
44. Walk-in still respects Availability and Capacity.
45. Guest Dashboard works.
46. Receptionist Dashboard works.
47. Housekeeping Dashboard works.
48. Admin Dashboard works.
49. Loading states exist.
50. Empty states exist.
51. Error states exist.
52. Confirmation dialogs exist.
53. Responsive design works on Desktop.
54. Responsive design works on Tablet.
55. Responsive design works on Mobile.
56. Core automated tests pass.
57. Frontend and Backend integrate successfully.
58. Alembic migrations work correctly.
59. README contains complete setup instructions.
60. Project can be run on a new development machine using the documentation.

---

# 97. Definition of Project Success

The Hotel Management System is considered successful when it provides a realistic and reliable core hotel operational workflow without expanding into a complete enterprise hospitality platform.

The project should demonstrate:

- Full-Stack Development
- React with TypeScript
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- JWT Authentication
- Role-Based Authorization
- Date-Based Reservation Logic
- Availability Calculation
- Overbooking Prevention
- Room Assignment
- State Management
- Check-in / Check-out
- Housekeeping Workflow
- Operational Status Management
- Safe Reservation Modification
- Automated Testing

The primary value of the project should come from its business logic:

```text
Room Types
+
Reservations
+
Availability
+
Room Assignment
+
Check-in / Check-out
+
Housekeeping
+
Room Readiness
```

The system should remain focused on **core hotel room operations** and should not evolve into a full ERP, accounting, restaurant, maintenance, travel, or payment platform in Version 1.