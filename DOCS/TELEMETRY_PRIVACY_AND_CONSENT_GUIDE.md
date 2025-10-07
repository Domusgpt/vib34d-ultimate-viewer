# Telemetry Privacy & Consent Guide

This guide captures the privacy, consent, and data minimization practices that govern telemetry usage across the Adaptive Interface Engine and associated SDK deliverables.

## Objectives
- Provide clear default classifications for emitted telemetry so partners understand when explicit consent is required.
- Describe how to gate analytics/biometric streams and expose audit trails for compliance reviews.
- Outline integration hooks for partner teams to extend consent flows and hardware adapter lifecycle events.

## Telemetry Classifications
The `ProductTelemetryHarness` now tags every event with a classification before dispatch. Default mappings:

| Classification | Description | Consent Default |
|----------------|-------------|-----------------|
| `system` | Operational health, adapter lifecycle, SDK boot events. | Allowed |
| `interaction` | Real-time adaptive focus/gesture streams required for UI responsiveness. | Allowed |
| `analytics` | Monetization, layout strategy, and design activation metrics. | Blocked until consent |
| `biometric` | Physiological streams (stress, heart rate, temperature). | Blocked until consent |
| `compliance` | Schema validation issues, consent updates, audit reporting. | Allowed |

Partners can append custom rules via `registerClassificationRule` or override defaults during SDK bootstrap (`telemetry.defaultConsent`).

## Consent Lifecycle
- `updateTelemetryConsent(map, metadata)` toggles any classification at runtime. The harness logs every change under `privacy.consent.updated` for audit review and exposes a snapshot via `getTelemetryConsent()`.
- Events that lack consent are dropped. The harness writes a `privacy.event.blocked` audit record containing the event name and classification so teams can surface consent dialogs or fallback UI.
- Identity calls default to the `system` classification. Pass `{ classification: 'analytics' }` to `identify` if identity is tied to analytics consent.

### Audit Trail
Call `telemetry.getAuditTrail()` (or `engine.getTelemetryAuditTrail()` via the SDK) to retrieve the rolling window (default 200 entries) of compliance events. The array includes timestamps, payload metadata, and the classification associated with each entry.

### Compliance Vault Provider
Use `ComplianceVaultTelemetryProvider` when compliance teams need a persisted export of consent changes and schema issues. The provider accepts a custom storage adapter (defaulting to `localStorage` or in-memory fallback), captures both telemetry events and audit log entries, and exposes `getRecords()`, `clear()`, and `flush()` helpers. The wearable designer demo now registers the vault by default, surfaces consent toggles, and lets reviewers download the captured JSON log.

## Sensor Validation Feedback
The `SensoryInputBridge` now publishes schema issues through three surfaces:
1. `sensoryBridge.setValidationReporter(fn)` – synchronous callback invoked whenever validation issues occur.
2. `sensoryBridge.getValidationLog()` – retrieves the rolling buffer of validation events.
3. `telemetry.recordSchemaIssue(issue)` – automatically invoked by `AdaptiveInterfaceEngine` to emit a `sensors.schema_issue` event with `compliance` classification.

Partners should use these signals to tie consent prompts or trust indicators back to raw hardware validation failures.

## Hardware Adapter Lifecycle
Sensor adapters can now implement optional `connect`, `disconnect`, and `test` methods. Use the new SDK wrappers to manage lifecycle state:

```js
const sdk = createAdaptiveSDK();

sdk.registerSensorAdapter('neural-intent', neuralAdapter);
await sdk.connectSensorAdapter('neural-intent');
const status = sdk.sensoryBridge.getAdapterState('neural-intent'); // { status: 'connected' }
```

`AdaptiveInterfaceEngine` emits telemetry events for registration, connection success, and failure paths (`sensors.adapter.*`), allowing downstream compliance tooling to verify adapter readiness before collecting biometric data.

## Implementation Checklist
- [x] Classify all telemetry events and gate analytics/biometric payloads behind consent.
- [x] Record consent changes and schema violations in an auditable log.
- [x] Expose adapter lifecycle hooks via the SDK and emit lifecycle telemetry.
- [x] Integrate UI consent prompts inside `wearable-designer.html` and partner plugin scaffolds. *(Demo shell now includes consent toggles + compliance export button; partner kits still pending.)*
- [ ] Extend schema validation reports to persist in long-term storage with partner-provided retention policies.

## Next Steps
1. Align with legal/privacy stakeholders on retention windows and cross-border data transfer policies for compliance telemetry.
2. Provide ready-made consent UI components in the wearable designer demo and partner plug-ins.
3. Evaluate TypeScript adoption for `ProductTelemetryHarness` to surface classifications and consent APIs at compile time.
