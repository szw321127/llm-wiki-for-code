# Add HTTP client retry policy

## Goal

Use the shared request client for transient retry handling instead of per-page fetch wrappers.

## Scope

- Update `src/api/client.ts`.
- Add `src/api/retryPolicy.ts`.
- Keep page integration in `src/pages/orders/OrderList.vue`.
