# Room booking

Schema: spectorque-1

## Purpose
Visitors reserve an available meeting room.

## Glossary
Booking means: one room reserved for one visitor and one time slot.
Allowed states: pending, confirmed, cancelled.

## Requirements
- FR-001: The booking API MUST return available rooms within 2 seconds for up to 100 rooms.
- FR-002: The booking system MUST reject overlapping bookings for the same room.
- NFR-001: The system MUST NOT expose personal data in public booking lists.

## Acceptance criteria
- GIVEN an available room WHEN a visitor reserves it THEN exactly 1 confirmed booking exists.
- GIVEN invalid dates WHEN a booking is submitted THEN the system MUST reject it.

## Out of scope
Payment processing is excluded.

## Dependencies
- Assumption: room availability is provided by the calendar API.
- If the calendar API fails, return an explicit unavailable response.

## Open questions
[NEEDS CLARIFICATION: Who may cancel another visitor's booking?]

[Implementation plan](plan.md)
