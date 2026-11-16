# Implementation plan

Schema: spectorque-1

[Specification](spec.md)

## Technical context
- Component: booking service owns overlap validation.
- Risk: calendar API may be unavailable.

## Data model
Booking: id, roomId, visitorId, start, end, state.

## Delivery
- T-001 implements FR-001.
- T-002 depends on T-001 and implements FR-002.
- T-003 implements NFR-001.

## Verification method
Manual check: submit two overlapping reservations. The second is rejected.
