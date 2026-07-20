1. never use radix-ui. use base-ui. if any implemented, refactor then QA. if not using radix / base, skip this line.

2. add pricing tier. i propose 4 tier with 1 tier is the base for trying out. i dont have any payment gateway yet, so make a package and mock real interfaces for it.

3. if havent, make it multi-tenant using better-auth. our user can have multi workspaces (for each client / projects / workspaces / organization). no need for multiple teams (better auth), only multi tenant. each user must have 1 workspace, cannot proceed if not have it.

4. never work on main branch. use `{feat|bugfix|release|hotfix}/*}` branches. open gh PR to main (use actual industry flow).

5. make sure elysiajs setted up for:
   a. openapi + scalar plugin (technical documentation. you propose to my right-hand for approval, whether it for public, private, or hybrid).
   b. opentelemetry.
   c. evlog.
   d. standardized envelope.
   e. helmet.

you can set them up as packages if it is complex enough / reusability concern / other aspects (you decide).

propose what you havent implemented from those points to my right-hand for approval.

6. always reindex @AGENTS.md periodically. (like 10 minutes or per epic).

7. force to fully setup & configured.

no need to handle empty / unconfigured (like github oauth, r2, and others), just stop OR continue.

stop if it is mandatory for user/human to provide it NOW. continue if it can be defered withouth any extra temporary implementation to pass it.

8. use t3 env for runtime env validations.

## Harness activation tiers (board-ratified 2026-07-20)

Directives #1–8 stay authoritative; tiers say **when** each applies during BMad MVP vs pre-production.

| Tier | When | Directives |
|------|------|------------|
| **T0** | Always during BMad | #4 branch+PR; #5 Elysia platform (done); #6 periodic `AGENTS.md` reindex |
| **T1** | Story/epic triggered | #1 base-ui when web epic starts; #3 multi-tenant via epic stories (e.g. 3.19); #8 t3-env on env-touching stories; #7 partial — stop only when mandatory human config is needed **now** (per #7) |
| **T2** | Pre-production gate | #2 pricing tiers + mock payment; #7 full enforcement; orchestrator + right-hand dual signoff; create `AGENTS_STOP_FILE` |

**Stop/ship gate:** Epics 0–8 MVP stories complete (Epic 9 excluded) **and** orchestrator + right-hand production confidence. This gate ends the harness loop (STOP), not deferral of T0/T1.

**King authorization (board YES_WITH_NOTES, 2026-07-20):** START the harness loop immediately — run BMad Epics 0–8 to 100% story completion (Epic 9 still excluded per gate above).
Dual signoff (orchestrator + right-hand) is required for **usable beta** or **first production deploy** before STOP; then create `AGENTS_STOP_FILE`.
T0/T1/T2 in this file remain in force; this authorization sets **scope and start**, not a waiver of tier discipline.

**Epic loop (board YES_WITH_NOTES 2026-07-20):** Run current epic to 100% story completion. Escalate to King in HARNESS-HUMAN-INPUT only when blocked AND right-hand board cannot resolve. Ultimate harness STOP unchanged (Epics 0-8 + dual signoff + AGENTS_STOP_FILE).

