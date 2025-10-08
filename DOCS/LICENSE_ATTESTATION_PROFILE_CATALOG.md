# License Attestation Profile Catalog

This catalog packages the curated attestation configurations that ship with the Adaptive Interface Engine. Use these profiles to
fast-track commercialization deals without copying attestor code between projects.

Each profile contains:

- **Endpoints** – attestation, revocation, and entitlement URLs with required headers.
- **Scheduling guidance** – default polling cadence plus overrides applied when the attestor binds to a license manager.
- **Service-level expectations** – fail-open policy, response targets, retry guidance, and availability promises.
- **Metadata** – segmentation, compliance regimes, and support tiers to align pricing and operational teams.

## Profiles

### enterprise-edge-2025 – Enterprise Edge Wearables
- **Audience:** Fortune 100 wearable deployments that demand tight compliance controls.
- **Endpoints:** `https://licenses.vib34d.com/enterprise/{attest|revocation|entitlements}` with `x-license-segment: enterprise-edge`.
- **Cadence:** Hourly attestation with 15-minute minimum poll interval, tightened to 45 minutes when bound to the license manager.
- **SLA:** 99.9% availability, 1.8s response target, three exponential retries (5s/15s/45s), fail-closed enforcement.
- **Metadata:** Enterprise segment, GDPR/HIPAA/ISO-27001 compliance, Gold support tier.

### regulated-health-2025 – Regulated Health Devices
- **Audience:** EU MDR and FDA-regulated health wearables with regional data residency requirements.
- **Endpoints:** `https://licenses.vib34d.com/health/{attest|revocation|entitlements}` plus `x-data-residency: eu` request header.
- **Cadence:** 30-minute attestation with 5-minute minimum, tightened to 20 minutes when licensed; remote attestor injects
  `region: eu-central` context metadata.
- **SLA:** 99.95% availability, 1.2s response target, two immediate retries before escalating to manual review, fail-closed.
- **Metadata:** Healthcare segment, EU residency, GDPR/MDD/FDA-820 compliance, Platinum support tier.

### indie-creator-2025 – Independent Creator Program
- **Audience:** Early-stage wearable creators testing new experiences with minimal operational overhead.
- **Endpoints:** `https://licenses.vib34d.com/creators/{attest|revocation|entitlements}`.
- **Cadence:** Six-hour attestation with one-hour minimum, relaxed to three hours when bound to a license manager, fail-open.
- **SLA:** 99.0% availability, 5s response target, queued retries every 15 minutes for up to four hours, designed for
  experimentation.
- **Metadata:** Creator segment, GDPR compliance, Silver support tier.

## Integration Notes
- Profiles load automatically unless `useDefaultLicenseAttestationProfiles` is set to `false` in telemetry options.
- Use `seedLicenseAttestationProfileIds` to ship a subset (e.g., only healthcare profiles for a regulated deployment).
- Override defaults with `overrideSeedLicenseAttestationProfiles: false` if you want to keep pre-registered partner profiles
  untouched.
- Partners can call `registerDefaultLicenseAttestationProfiles` at runtime to add the curated pack into an existing registry or
  blend the defaults with bespoke attestors.

## Change Log
- **2025-10-20:** Initial catalog published with enterprise, regulated health, and creator profiles plus configuration guidance.
