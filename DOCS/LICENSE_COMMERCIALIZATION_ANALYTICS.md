# License Commercialization Analytics Bridge

The commercialization analytics bridge turns license attestation registrations into dashboard-ready summaries. It is implemented by `src/product/licensing/LicenseCommercializationReporter.js` and consumed by the telemetry harness/Adaptive SDK so partners can see entitlement coverage without reimplementing audit logic.

## What It Tracks

- **Pack registrations.** Every call to `registerLicenseAttestationProfilePack()` records the pack id, metadata, default profile, and which profiles were registered.
- **Profile registrations.** Direct calls to `registerLicenseAttestationProfile()` (from packs or partner code) are captured with source metadata so dashboards can distinguish catalog packs from bespoke profiles.
- **Default changes and adoption.** Applying or changing a default profile, plus invoking `setLicenseAttestorFromProfile()`, updates adoption counters and timestamps. The reporter aggregates adoption counts per profile, segment, region, and pack.
- **SLA benchmarks.** Response targets, availability, and breach windows are summarised (min/max/average) to highlight SLA outliers.

## Accessing Summaries

```js
const sdk = createAdaptiveSDK({
  telemetry: {
    commercialization: {
      onUpdate(summary) {
        console.log('Updated commercialization metrics', summary);
      }
    }
  },
  licenseAttestationProfilePacks: ['enterprise-saas']
});

const summary = sdk.getLicenseCommercializationSummary();
console.table(summary.packs.map(pack => ({
  id: pack.id,
  adoption: pack.adoptionCount,
  defaultProfile: pack.defaultProfileId
})));
```

The summary object mirrors the Vitest expectations documented in `tests/vitest/license-commercialization-reporter.test.js`. It includes:

- `packs`: pack-level adoption data, metadata, and default profile identifiers.
- `profiles`: per-profile adoption counts, SLA snapshots, and pack references.
- `segments` / `regions`: aggregated coverage counts with adoption totals.
- `sla`: aggregate metrics for response time, availability, and breach windows.
- `defaultProfileId`: the current default applied by the telemetry harness.
- `lastUpdated`: ISO timestamp for the most recent change.

## UI Integration

`wearable-designer.html` consumes `getLicenseCommercializationSummary()` to render a commercialization coverage panel. The panel updates automatically via the `telemetry.commercialization.onUpdate` callback passed to `createAdaptiveSDK`, showcasing how partners can bind the summary to analytics dashboards or BI tooling.【F:wearable-designer.html†L318-L453】

## KPI Snapshots & Exports

The commercialization bridge now ships with `LicenseCommercializationSnapshotStore`, which captures periodic KPI snapshots and exposes BI-friendly exports. The telemetry harness wires the store automatically (unless disabled) and provides helper methods for manual capture, scheduling, and exporting:

```js
const sdk = createAdaptiveSDK({
  telemetry: {
    commercialization: {
      snapshotIntervalMs: 60_000,
      snapshotStore: {
        maxSnapshots: 48
      }
    }
  }
});

// Manual capture + KPI reporting
sdk.captureLicenseCommercializationSnapshot({ trigger: 'quarterly-review' });
const kpiReport = sdk.getLicenseCommercializationKpiReport();

// Export for BI tooling
const exportJson = sdk.exportLicenseCommercializationSnapshots({ format: 'json', includeSummary: false });
const csv = sdk.exportLicenseCommercializationSnapshots({ format: 'csv' });
```

Within the wearable designer demo, the "Commercialization Coverage" panel now includes snapshot controls, KPI deltas, and export triggers so stakeholders can experience the workflow without writing additional code.【F:wearable-designer.html†L318-L474】

## Follow-Ups

- Expand the pack catalog (healthcare, education) with commercialization metadata so KPI snapshots can highlight regulated market coverage.
- Define external persistence for snapshot exports (S3/log broker) and wire nightly KPI jobs before partner portal rollout.
- Extend partner docs with KPI interpretation guidance and sample dashboard widgets fed by the CSV/JSON exports.
