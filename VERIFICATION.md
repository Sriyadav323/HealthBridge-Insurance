# Admin module implementation and verification

Latest verification: **November 1, 2026 (America/Chicago client date)**. All test data was synthetic. No existing database was accessed, migrated, overwritten, or reset; no public deployment was performed.

## Backup

There was no Git repository. Before this change, the source/configuration/SQL backup was created with owner-only permissions:

`/private/tmp/healthbridge-before-admin-20261031-155139.tar.gz`

It excludes `.env` files, dependencies, build output, logs, archives, and old source backups. It is a source backup, not a backup of the running PostgreSQL database. The earlier portfolio backup also remains available.

## Completed behavior

- PostgreSQL-backed ADMIN and MEMBER roles, loaded at login and checked against the live database on authenticated requests.
- Separate role-protected admin/member routes and navigation, with role-based landing pages; Spring Security remains the authorization boundary.
- Session-based authentication, BCrypt, CSRF, logout, expiration handling, live revocation, and member-principal query scoping preserved.
- Session versions prevent disable/re-enable from reviving an old session. Changes to login email or roles revoke old sessions.
- Database-derived dashboard counts and recent registrations; old registration dates remain unknown rather than being fabricated.
- Member directory with name/ID/email search, coverage/account filters, bounded server pagination, details, edits, account enable/disable, and confirmation dialogs.
- Transactional registration, unique member IDs, email validation, case-insensitive email uniqueness, forced MEMBER assignment, and conflict handling without partial records.
- Expiring 256-bit password setup tokens, SHA-256 hashes at rest, URL-fragment delivery, CSRF-protected submission, BCrypt password storage, and atomic single-use consumption. Setup never auto-authenticates a browser.
- Admin-only reissue/revocation of pending setup links. Email changes revoke old setup links too. Completed setup is not a general password-reset mechanism.
- No HTTP administrator-registration or role-editing endpoint. A trusted interactive schema-owner tool creates a new administrator, without modifying existing identities or exposing passwords.
- Runtime database credentials cannot write role tables. A narrowly scoped function can grant MEMBER only.
- Record versions protect against stale administrator writes. Plan changes preserve stored benefits but flag financial terms for review; the UI hides obsolete/unconfigured amounts.
- Existing dashboard, benefits, claims, provider search, ID card, profile, pharmacy, and logout remain covered by regression tests.

## Results

| Check | Result |
| --- | --- |
| Java 21 backend `./mvnw verify` | **43 tests passed**; no failures, errors, or skips; executable JAR packaged |
| Frontend `npm test` | **36 tests passed** across 8 files |
| Frontend `npm run lint` | Passed |
| Frontend `npm run build` | TypeScript and Vite production build passed |
| Packaged backend + actual PostgreSQL | Passed with a new temporary cluster and generated test credentials |
| Role boundaries | Admin/member login; member admin-API rejection (403); anonymous rejection (401); admin-only identity barred from member self-service |
| Admin data and pagination | Live statistics, separate pages, search, coverage/account filters, validation, administrative identity exclusion |
| Registration and updates | MEMBER forced despite supplied ADMIN field; duplicate registration/update rollback; stale-version rejection; no password hashes in DTOs |
| Account controls | Enable/disable; pending-setup restrictions; stale sessions remain invalid after disable/re-enable; email changes revoke sessions |
| Setup security | CSRF, expiry, replay, supersession, revocation, email-change revocation, hashed tokens, no auto-login; concurrent requests yielded exactly one 204 and one 400 |
| Plan changes | Existing member financial records retained, with benefit terms marked pending review rather than presented as new-plan terms |
| SQL migrations | Fresh initialization and repeated application passed without resetting records or changing existing roles |
| Runtime role permissions | Direct INSERT into role tables denied; MEMBER-only function executable; no claim DELETE permission |
| Shell/Python syntax and Compose YAML | Passed; YAML parsing is not a Docker runtime check |
| Docker builds / Compose execution / Nginx runtime | **Not executed: Docker is not installed** |
| Full browser visual/accessibility audit | **Not executed**; responsive/accessibility source improvements and DOM tests only |

Backend tests used Java **21.0.13.0.3**. Frontend checks used Node **26.7.0** and npm **11.19.0**. The actual database smoke test used PostgreSQL **18.6** and the available default JVM (Java 25) to run the Java-21-targeted JAR. Docker's Java 21 / Node 24 / PostgreSQL 17 environments remain unverified.

The latest isolated PostgreSQL smoke directory is:

`/var/folders/39/xwdwbfqx41zb2hsmd2595nc40000gn/T/healthbridge-smoke-0crkdwj4`

Temporary services were stopped; private test files were retained. No generated password or setup-token value is included in this report.

## Migrations and operator steps

1. Review/back up the intended existing database. Apply `backend/database/migrations/V001__admin_members.sql` as its schema owner in a transaction.
2. Export `DB_USERNAME` as the separate runtime database role and apply `V002__runtime_permissions.sql` through psql as schema owner. Fresh Compose volumes already run both files in the correct order.
3. Restart the backend/frontend and sign in again; older sessions do not carry the new role information.
4. Use the interactive `ProvisionAdmin` launcher with schema-owner database credentials to create a synthetic administrator. See the root README for local and Docker commands. No default administrator password exists.
5. Sign in as ADMIN, register a member, and share the one-time setup link privately. In local testing use a separate private browser window for the member.

The provisioner is compiled into the executable JAR. Its interactive successful-creation path was not automated; integration tests provision synthetic fixtures directly and verify administrator login and database authority enforcement. No administrator was provisioned in your existing database.

## Changed files

The principal additions are:

- `backend/database/migrations/V001__admin_members.sql`, `V002__runtime_permissions.sql`, and updated `docker/postgres/init.sh`.
- `backend/src/main/java/com/healthbridge/backend/admin/`: controllers, DTOs, member-management service, and password-setup service.
- `backend/src/main/java/com/healthbridge/backend/tools/ProvisionAdmin.java`; updated member provisioner.
- Updated security configuration, authentication/session filter, exception handling, profile version updates, and benefit configuration flags.
- `frontend/src/features/admin/`: dashboard, directory, registration/details pages, shared form/setup-link notice, types, CSS, and tests.
- Updated frontend session context, role routing, main layout, API-data reload handling, and existing member financial displays.
- New password setup page/tests; expanded backend, routing, and member regression tests.
- Updated `scripts/smoke_test.py`, `README.md`, and this report.

No new application/test dependencies were introduced for this module.

## Remaining limitations

- Existing-database migrations and administrator provisioning are deliberate operator steps; they were not performed on your running database.
- Email delivery is not configured. A trusted administrator must share setup links through a secure channel. Links are shown once and are not recoverable; reissue replaces the previous link.
- Benefit-term configuration/review, general password reset, member deletion, and administrator-role management through the UI are outside this module. Plan edits flag financial terms for review without deleting stored coverage or benefits.
- Members without existing login accounts remain visible. The local MEMBER provisioner can create their account explicitly; an enable action cannot create a missing account.
- Public hosting still requires HTTPS, Secure session cookies, host-managed secrets, login rate limiting, monitoring, and a reviewed deployment configuration. No deployment was performed.
- Sessions remain process-local; backend restarts require sign-in, and multiple replicas need session affinity or a designed shared-session store.
