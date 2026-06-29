# Moling Platform Integration Flow

## Integration Goals

- Reuse Moling identity and access control.
- Reuse Moling prepaid credit products and entitlement ledger.
- Keep internal platform credentials server-side.
- Provide auditable billing behavior for every chargeable AI action.

## Application Launch

1. Moling product entry redirects to the application access URL.
2. Redirect includes a one-time launch ticket.
3. Application backend verifies the ticket with Moling internal API.
4. Backend validates app and product association.
5. Backend creates its own application session.

The current implementation reads `MOLING_APP_ID` and `MOLING_PRODUCT_ID` from environment variables and rejects launch tickets whose `app_id` or `product_id` do not match. Deployment commands may also use the compatibility aliases `PPT_APP_ID`, `PPT_PRODUCT_ID`, and `PORT`.

## Product and Entitlement Setup

Platform configuration must provide:

- application record
- application product
- credit packages or plans
- role access rules for view, buy, and use
- internal API token through a secure channel
- allowed application server IPs

## Entitlement Discovery

The application needs a reliable way to identify the current user's active PPT credit entitlement. Supported future options:

- Moling launch verification returns the active entitlement.
- Moling provides an internal entitlement lookup by user and product.
- The app uses a user-scoped token to query the user's entitlements.

Until Moling provides entitlement discovery, configure `MOLING_DEFAULT_ENTITLEMENT_ID` or compatibility alias `PPT_DEFAULT_ENTITLEMENT_ID`. Chargeable APIs use that value when the request does not include `entitlement_id`, and the workspace page pre-fills the same ID.

## Internal API Boundary

- Backend calls Moling internal APIs with `INTERNAL_API_TOKEN`.
- Frontend never calls Moling internal APIs.
- Internal token is never logged, stored in the database, or sent to users.

## Acceptance for Integration

- invalid tickets cannot create sessions
- app/product mismatch is rejected
- insufficient credits are surfaced without AI provider calls
- reserve, settle, and release are idempotent
- platform errors map to stable application errors
