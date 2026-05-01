# Security Specification - G Zone Rap Battle Live Vote

## 1. Data Invariants
- A `Vote` must be linked to a valid `Battle`.
- A user can only vote once per `Battle`.
- Only admins can start/stop battles.
- Votes can only be cast when a battle is `active`.
- `votesA` and `votesB` counters in `Battle` must be updated atomically when a `Vote` is created.

## 2. The "Dirty Dozen" Payloads

1. **Self-Promotion**: Non-admin attempts to change battle status to `active`.
2. **Double Vote**: Authenticated user attempts to create a second vote for the same battle.
3. **Ghost Vote**: Vote submitted with a random UUID for `voterId` that doesn't match the authenticated user.
4. **Zombification**: Attempting to vote on a `finished` battle.
5. **Counter Spoof**: Manually updating a battle's `votesA` counter without creating a `Vote` document.
6. **Identity Poisoning**: Using a 2KB string as a document ID.
7. **Negative Tally**: Attempting to decrement votes.
8. **Time Travel**: Submitting a vote with a `timestamp` from the past/future (not server time).
9. **Option Hijack**: Submitting a choice that is not 'A' or 'B'.
10. **Battle Creation**: Non-admin attempting to create a new battle.
11. **Admin Escalation**: Non-admin attempting to add themselves to the `admins` collection.
12. **Mass Deletion**: Attempting to delete the entire `votes` collection.

## 3. Test Runner
(I will implement the logic checks in the firestore.rules and verify conceptually as I cannot run local emulators here with a full node test runner easily, but I will ensure the logic is airtight).
