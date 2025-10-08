# Environment Automation Plan

## Purpose
Define a pragmatic testing automation path that balances lightweight container environments with the need for high-fidelity wearable UI validation. This plan closes backlog item **B-07** by specifying tooling lanes, configuration requirements, and follow-up tasks for CI enablement.

## Testing Lanes
| Lane | Tooling | Primary Goal | Execution Notes |
|------|---------|--------------|-----------------|
| **Unit/contract** | `vitest` + `jsdom` | Fast feedback on adaptive layout, telemetry, and consent logic. | Runs via `npm test` inside any Node 18+ environment. Uses pure JS—no browser dependencies. |
| **Smoke UI** | Playwright (Chromium-only) | Validate wearable demo shell wiring, consent UI, and audit downloads. | Trigger manually or in CI with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` when running inside slim containers. Uses pre-bundled browsers or shared cache. |
| **Visual/regression** | Playwright (full matrix) | Capture screenshots/video for wearable shells, pattern packs, and partner plug-ins. | Runs inside dedicated CI jobs backed by the Playwright Docker image (`mcr.microsoft.com/playwright:v1.55.0-focal`). Optional for MVP but required before GA. |

## Configuration Matrix
| Scenario | Command | Dependencies |
|----------|---------|--------------|
| Local dev (unit) | `npm test` | Node 18+, no browsers. |
| Local dev (smoke) | `npm run test:e2e:smoke` | Requires one-time `npx playwright install`. |
| Container/CI smoke | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm run test:e2e:smoke` | Supply Chromium via cached `/ms-playwright` volume or Docker image. |
| Full visual regression | GitHub Actions/Buildkite job using Playwright image | Access to >4 GB disk and system dependencies. |

## Action Items
1. **Cache Playwright browsers in CI.** Mount `/ms-playwright` as a persistent workspace volume so `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` still finds cached binaries. GitHub Actions example:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.cache/ms-playwright
       key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
   - run: npx playwright install chromium
   ```
2. **Add Chromium-only smoke job.** Configure CI to run `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm run test:e2e:smoke` after `npm test`. Tag lightweight scenarios with `@smoke` (see `tests/consent-compliance-smoke.spec.js`) and expand coverage as new UI modules stabilize.
3. **Adopt Playwright Docker image for full runs.** Provision a weekly or release-branch job that uses `mcr.microsoft.com/playwright:v1.55.0-focal` and executes the full suite (Chromium + WebKit + Firefox) once OS dependency approvals land.
4. **Monitor footprint.** Track install size and execution time in the development tracker; adjust caching strategy or split jobs if Playwright continues to strain the base container.

## Status
- ✅ Vitest + jsdom lane operational (`npm test`).
- ✅ Automation plan approved (this document) with clear smoke vs. visual expectations.
- ✅ Playwright smoke spec authored (`tests/consent-compliance-smoke.spec.js`) and tagged `@smoke` for CI gating.
- 🔄 Pending: Integrate browser cache + container image selection into CI configs.

## Next Review
- **Owner:** Core Team Lead
- **Date:** 2025-10-20
- **Agenda:** Verify smoke job integration, decide on browser cache location, and assess whether remote rendering partners require additional automation hooks.
