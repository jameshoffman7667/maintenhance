# Gap analysis: MaintEnhance v2.9.0 vs app development spec v1.9 (2026-11-05)

Nothing here has been built. Every gap is logged in docs/pending-changes.md (P-6, P-7, P-8, P-11 to P-16).

| Area | Gap | Entry |
| --- | --- | --- |
| Container | No SIGTERM handling, no tini, runs as root | P-6 |
| Container | Healthcheck tests HTTP status only, not the "status":"ok" body; no /healthz test | P-12 |
| Container | No lockfiles, `npm install`, floating node:20-slim, build tools kept in final image | P-13 |
| Security | JWT_SECRET falls back to a hard-coded value; no trust proxy; no Origin check; no CSP/security headers | P-14 |
| Data | No schema_version table or pre-migration backup | P-15 |
| PWA | manifest.json not .webmanifest, no id, no 180px apple-touch icon, no offline page, cache-first SW with skipWaiting and no update prompt, no iOS install hint | P-7 |
| UI | No bottom nav on mobile, breakpoints differ from spec, no 320px check, no Lighthouse run | P-7 |
| Tests | No `npm test` | P-8 |
| Docs | No docs/functional-spec.md with Mobile/Desktop/PWA sections | P-8 |
| Deploy files | RELEASE.md Update line placement, no Actions run line, no deploy/.env.example, root compose lacks healthcheck/log limits/pin | P-11, P-16 |

Conforming: release workflow (valid variant), /healthz body and no-auth, versions in sync, CHANGELOG limits, money handling noted as a deviation to confirm.

## Status 2026-11-07
All gaps above were built in v2.10.0 (P-6 to P-8, P-11 to P-16), except the Cloudflare Access JWT check and two-step sign-in decision (P-17). Lighthouse and layout findings are P-18. iOS install instructions were dropped. Money stays as decimal dollars by James's decision.
