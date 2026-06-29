# Billing Module

The billing foundation wraps Moling prepaid entitlement operations.

Current implementation:

- `src/billing.js`
- reserve credits
- settle credits
- release credits
- balance lookup
- consume operation
- numeric ID coercion for Moling JSON payloads

Third-stage usage:

- `PptService.generateDeck` calls balance -> reserve -> settle/release.
- `PptService.regenerateSlide` calls consume.
- billing events are recorded for reserve, settle, release, and consume.

Future work:

- reconciliation worker
