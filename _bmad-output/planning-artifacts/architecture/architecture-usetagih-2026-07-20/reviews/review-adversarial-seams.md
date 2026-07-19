# Review — adversarial seam check

**Verdict:** PASS (one note)

## Constructed divergence attempts

1. **Web server action calling Drizzle directly** — Blocked by AD-2 (web must use public REST only).
2. **SDK bundling separate Zod copy** — Blocked by AD-1 (single schema package).
3. **Worker skipping idempotency** — Blocked by AD-4/AD-5 (same use-case path for sync/async).

## Note (medium)

- Session→Bearer token bridge for web could duplicate API key auth logic if implemented in web rather than api. **Mitigation:** implement `POST /v1/session/token` in `apps/api` only; document in SOLUTION-DESIGN §15.

No critical seam holes.
