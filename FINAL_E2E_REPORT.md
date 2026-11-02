# HealthBridge final functional verification

Date: **November 1, 2026 — America/Chicago**

**Result: PASS for the automated API and React DOM checks. Full browser E2E verification is BLOCKED, not passed.** No functional failure was found in the exercised paths. No existing real/demo member or administrator record was changed during this verification.

## Execution boundaries

- Browser discovery returned no usable apps/browsers: `The browser access host is unavailable` and `Sky Computer Use native pipe closed before response`.
- Consequently, **no functionality in this run was tested by interacting with a real browser**. React Testing Library/jsdom tests are DOM tests, not browser tests.
- Authenticated API flows used a freshly initialized temporary PostgreSQL cluster and a separate packaged backend on random loopback ports. All accounts, passwords, tokens, and mutations belonged to that disposable test environment. The usual database and servers on ports 5432, 8081, and 5173 were not modified or restarted.
- The running frontend was checked separately through read-only HTTP requests. An HTTP 200 SPA shell does not prove that its JavaScript renders correctly.
- Temporary test services were stopped after completion. Private test files were retained; passwords and tokens are not included in this report.

## Functional pass/fail matrix

| Requested flow | API integration | React DOM tests | Actual browser |
| --- | --- | --- | --- |
| ADMIN login and dashboard statistics | **PASS** — database-backed ADMIN authority, statistics match synthetic records; admin identities excluded from member counts | **PASS** — role-based landing/navigation and displayed statistics | **NOT RUN** |
| Member list, search, filters, pagination | **PASS** — distinct server-side pages, name search, literal wildcard handling, coverage/account filters, bounds validation | **PASS** — search/filter/page actions send expected server parameters | **NOT RUN** |
| Registration and password setup | **PASS** — transactional registration, forced MEMBER role, duplicate-email rollback, CSRF, expiry/replay/revocation/email-change invalidation; concurrent consumption yields exactly one success | **PASS** — registration form, conflict state, private setup link, password submission and errors | **NOT RUN** |
| MEMBER login and feature access | **PASS** — benefits, claims, providers, prescriptions, and profile; both populated synthetic fixtures and newly registered empty-state accounts; cross-member isolation | **PASS** — dashboard, benefits, claims, providers, prescriptions, profile, ID-card routing under Strict Mode | **NOT RUN** |
| Digital ID card | **PASS for supporting benefits API only** — no separate card API exists | **PASS** — authenticated member data, front/back switching, pressed-state semantics, print-handler invocation | **NOT RUN** — actual print preview/PDF and print styling remain manual |
| Member profile updates | **PASS** — CSRF-protected self-service update; another synthetic member's contact data remains unchanged; invalid input rejected | **PASS** — load, edit, save, CSRF header, success message | **NOT RUN** |
| ADMIN activation/deactivation | **PASS** — disabled login rejected, re-enabled login accepted, previous sessions remain revoked; pending setup restrictions; stale edits rejected | **PASS** — confirmation required, cancellation prevents request, updated status reloads | **NOT RUN** |
| Logout and session expiration | **PASS** — both roles' logout; actual Tomcat idle expiry: authenticated access before inactivity, HTTP 401 after 63 idle seconds with the same cookie | **PASS** — logout clears protected content; 401 and window-focus rechecks remove expired member content | **NOT RUN** |
| Unauthorized admin access | **PASS** — unauthenticated admin requests return 401; MEMBER admin API requests return 403; ADMIN-only identities cannot access MEMBER self-service | **PASS** — member admin-route redirects and absent admin navigation | **NOT RUN** |
| Responsive layouts | **NOT APPLICABLE** | **NOT PROVEN** — CSS breakpoints reviewed, but jsdom does not measure rendered layout | **BLOCKED** — desktop/tablet/mobile visual checks required |
| Browser console errors | **NOT APPLICABLE** | **PASS within tested DOM navigation** — no unexpected `console.error` or `console.warn` calls | **BLOCKED** — browser DevTools/network/runtime console not captured |

## Check results

| Command/check | Result |
| --- | --- |
| Java 21 `./mvnw verify` | **43 tests passed**, zero failures/errors/skips; executable JAR built |
| `npm test` | **38 tests passed**, 9 files |
| `npm run lint` | **PASS**, no warnings/errors |
| `npm run build` | **PASS**, TypeScript and Vite production build |
| `python3 scripts/smoke_test.py` | **PASS**, actual PostgreSQL integration plus real idle-session expiration |
| Live frontend HTTP shells | **PASS** — `/admin`, `/admin/members`, `/profile`, `/id-card`, `/set-password` return the SPA shell |
| Live frontend proxy, anonymous requests | **PASS** — admin dashboard/list and member profile API requests return 401 |
| Compose YAML parse | **PASS for syntax only** |
| Local start/bootstrap shell syntax | **PASS** |
| Docker image build, Compose startup, Nginx behavior | **NOT RUN** — Docker executable is unavailable |

Backend build/tests used Java 21.0.13.0.3. Frontend checks used Node 26.7.0 / npm 11.19.0. API integration used PostgreSQL 18.6 and the available default Java runtime to run the Java-21-targeted JAR. Exact Docker Java 21 / Node 24 / PostgreSQL 17 image execution remains unverified.

Isolated integration files:

`/var/folders/39/xwdwbfqx41zb2hsmd2595nc40000gn/T/healthbridge-smoke-vo00c0jj`

## Changes made during verification

No application behavior needed correction in the exercised checks. Test coverage gaps were addressed:

- `scripts/smoke_test.py`: newly registered member read/self-update coverage, disabled/re-enabled login checks, and a real one-minute server idle-timeout check. The timeout setting is confined to a separate temporary backend; the running application's configured timeout is unchanged.
- `frontend/src/features/id-card/components/InsuranceIdCard.test.tsx`: front/back/card-data and print-handler coverage.
- `frontend/src/features/auth/RequireSession.test.tsx`: session revalidation on window focus.
- `frontend/src/App.test.tsx`: fail on unexpected console errors/warnings during feature navigation.
- Documentation: this report and README link/timing note.

Pre-edit test-file backup:

`/private/tmp/healthbridge-verification-scripts-20261101-004859`

## Required manual browser verification

Use **http://localhost:5173/admin** and **http://localhost:5173/**. Use a synthetic ADMIN and a newly registered synthetic MEMBER in separate browser profiles/private windows. Do not change existing real/demo members. Do not capture passwords or setup links in screenshots, recordings, shared console output, or this report.

1. Sign in as ADMIN. Confirm the dashboard counts and recent registrations match the member directory. Search by name, member ID, and email; combine filters; move forward/back through multiple result pages.
2. Register a synthetic member. Transfer its private setup link to the member's private window. Set a password, then sign in. Verify expired/reused links show a clear error.
3. Visit every member feature. New-member claims/prescriptions should have clear empty states; benefit amounts should say awaiting configuration rather than claim zero-dollar coverage. Check both ID-card sides and browser print preview/Save as PDF.
4. Update only that synthetic member's profile and refresh to confirm persistence.
5. As ADMIN, disable the synthetic account. Its current member session should lose access on its next API request or tab-focus check, and a fresh sign-in should fail. Re-enable it and sign in again; the old session must not revive.
6. From the MEMBER window visit `/admin` and `/admin/members`: expect a redirect to the member dashboard. Direct admin API requests must return 403. After logout, protected APIs must return 401 and member data must disappear.
7. At viewport widths **1280, 768, 390, and 320 pixels**, check navigation, cards, forms, confirmation dialogs, and horizontal table scrolling. Tab through links, filters, fields, and actions; confirm visible focus and useful error/loading states.
8. Keep DevTools Console/Network open through both role flows. Check for uncaught JavaScript errors, React warnings, failed assets, unexpected 5xx responses, or unhandled promises. Expected 401/403 responses during authorization tests are not functional failures.

These manual items remain **NOT RUN**, rather than being inferred from successful API tests.

## Blockers before Docker verification and deployment

1. Restore browser automation access or complete and record the manual browser checklist, including responsive layout, browser console, and printing.
2. Install/start Docker, then build the images and test Compose health checks, fresh-volume initialization, Nginx same-origin proxying, deep-link routing, and session cookies. Do not remove existing database volumes to test an upgrade.
3. Before any public deployment, review HTTPS/Secure cookies, explicit routing, host-managed secrets, login rate limiting, database backup/recovery, and session persistence. The Mac's current local PostgreSQL authentication must not be treated as a production credential configuration.
4. Email delivery, a full password-reset flow, and benefit-term editing/review remain explicit product limitations documented in the README. Decide which are required for the intended deployment; first-time setup currently relies on secure manual link sharing.

**No deployment approval is implied by these passing tests. Nothing was publicly deployed.**
