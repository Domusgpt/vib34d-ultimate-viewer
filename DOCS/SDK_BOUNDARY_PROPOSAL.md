# Adaptive SDK Boundary Proposal

## Purpose
Define an explicit, supportable interface for product teams and partners consuming the adaptive engine. The proposal captures the initial module surface, dependency injection patterns, and packaging considerations required to evolve the prototype into a salable SDK.

## Guiding Principles
1. **Composable inputs and outputs.** Sensor feeds, layout strategies, and telemetry providers must be replaceable without deep
   engine changes.
2. **Progressive adoption.** Downstream products should be able to adopt a subset (e.g., layout only) before integrating full
   adaptive control loops.
3. **Commercial hardening.** Licensing checks, telemetry consent, and extension hooks ship as part of the boundary rather than
   ad-hoc demo logic.

## Proposed Public Surface
| Area | Export | Responsibilities |
|------|--------|------------------|
| Core | `AdaptiveInterfaceEngine` | Lifecycle orchestration, module registry, high-level `renderAdaptiveFrame(context)` API. |
| Inputs | `SensoryInputBridge`, `SensorSchemaRegistry`, `registerSensorSchema`, sensor adapter interfaces | Normalization + validation contracts for gaze, neural, biometric, ambient signals plus adapter lifecycle controls. |
| Layout | `SpatialLayoutSynthesizer`, `LayoutStrategy`, `LayoutContext` types | Strategy registration, generation of layout descriptors, annotations, and motion cues. |
| Patterns | `InterfacePatternRegistry`, `DesignLanguageManager` | Mapping between layout descriptors and monetizable UI packages. |
| Telemetry | `TelemetryClient`, `TelemetryProvider`, `ComplianceVaultTelemetryProvider`, `createSignedS3StorageAdapter`, `createLogBrokerStorageAdapter`, `createRequestSigningMiddleware`, `ProductTelemetryHarness` compatibility shim | Event buffering, request middleware orchestration, consent state, compliance exports, remote persistence adapters, and attestation/audit stream publication for licensing events. |
| Licensing | `LicenseManager`, `LicenseStatus`, `LicenseValidator`, `RemoteLicenseAttestor`, `LicenseAttestationProfileRegistry` types | Centralized license validation, feature gating, remote attestation/revocation checks, entitlement synchronization, attestation profile catalogs, and commercialization reporting feeding telemetry guards. |
| Experience | `createConsentPanel` | Reusable consent UI for demos and partner plug-ins. |
| Utilities | `createAdaptiveSDK(config)`, `AdaptiveError`, `AdaptiveLogger`, `types/adaptive-sdk.d.ts` | Bootstrapping helper returning configured engine + telemetry/consent/license hooks with type definitions. |

### Telemetry Provider Hardening Expectations
- **Signed requests:** Providers that leave the device/network (HTTP/partner adapters) must expose a `registerRequestMiddleware` hook or accept `requestSigner` configuration so the SDK can enforce tenant-specific signing (HMAC, OAuth2 client credentials, etc.). The harness now ships with `registerTelemetryRequestMiddleware` plus `createRequestSigningMiddleware` to normalize signing payloads before `track`/`flush`.
- **Consent customization:** `createAdaptiveSDK` forwards `consentOptions` to `createConsentPanel`, enabling downstream products to override labels, default states, or add jurisdiction-specific toggles while reusing the shared UX contract. Partner plug-ins should rely on these options rather than forking the component to maintain parity with compliance copy updates.
- **Retention/encryption reporting:** Remote storage adapters propagate `retentionPolicy` and `encryptionMetadata` through upload callbacks and signing payloads. Providers must log these values alongside export identifiers so customer success teams can audit compliance posture without raw data access.

## Dependency Injection Model
- **Sensors:** supply adapters via `createAdaptiveSDK({ sensorAdapters: [...] })` or manually call `registerSensorAdapter(type, adapter)`. Adapters may implement `connect`, `disconnect`, `test`, and `read` (pull) or use the `ingest` hook (push). Schemas can be registered via `sensorSchemas` config or `registerSensorSchema` helper.
- **Layout Strategies:** `SpatialLayoutSynthesizer` exposes `registerStrategy(strategy)` and `clearStrategies()` for swapping
  out bundles. Built-in strategies remain available as fallbacks.
- **Telemetry Providers:** Providers implement `identify`, `track`, and `flush`. The runtime defaults to buffered mode via
  `ProductTelemetryHarness` + `ConsoleTelemetryProvider` when no provider is specified.
- **Pattern Packs:** `InterfacePatternRegistry` accepts packaged bundles containing metadata, monetization hints, and renderers.

## Packaging Plan
1. **Phase 1:** Ship as ESM bundle + type definitions. Provide factory `createAdaptiveSDK` returning
   `{ engine, sensoryBridge, telemetry, licenseManager, licenseAttestor, registerSensorSchema, registerSensorAdapter, connectSensorAdapter, disconnectSensorAdapter, testSensorAdapter, registerTelemetryProvider, registerTelemetryRequestMiddleware, clearTelemetryRequestMiddleware, registerLicenseAttestationProfile, getLicenseAttestationProfiles, getLicenseAttestationProfile, setDefaultLicenseAttestationProfile, setLicenseAttestorFromProfile, updateTelemetryConsent, getTelemetryConsent, getTelemetryAuditTrail, setLicense, validateLicense, getLicenseStatus, getLicenseHistory, getLicenseAttestationHistory, setLicenseAttestor, requestLicenseAttestation, onLicenseStatusChange, createConsentPanel }` and honoring `sensorSchemas`, `sensorAdapters`, `consentOptions`, `telemetryConsent`, `license`, `licenseAttestor`, `licenseAttestationProfiles`, and `licenseAttestorProfileId`/`licenseAttestorProfileOverrides` configuration while bundling `createConsentPanel`, request signing middleware, and the compliance storage adapters for partner reuse.
2. **Phase 2:** Publish adapters for React/Vue/Web Components. Ensure wearable demo consumes the same factory to avoid drift.
3. **Phase 3:** Release plug-in kits (Figma/Webflow) that call into the SDK boundary for previews and telemetry capture.

## Acceptance Criteria
- Runtime initialization requires only the configuration object defined above.
- Layout/telemetry modules expose abstract strategy/provider interfaces with Vitest coverage.
- Telemetry consent + license keys enforced before any `send` call, including partner-provided signing middleware registered via `registerTelemetryRequestMiddleware`, and remote attestation failures default to blocking telemetry unless fail-open is explicitly configured.
- README and integration docs reference the SDK surface rather than internal files.

## Open Questions
- How should we version pattern packs relative to engine releases?
- Do we need a compatibility layer for legacy VIB34D gallery consumers?
- Should licensing checks block engine boot or degrade gracefully with limited features?

## Next Steps
1. Align backlog item **B-01** with this boundary and break down implementation tasks.
2. Provide type sketches (TypeScript or JSDoc) for the exported interfaces.
3. Schedule design review with partner teams to validate packaging expectations.
