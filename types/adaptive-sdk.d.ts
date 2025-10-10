export interface SensorSchemaIssue {
  field: string;
  code: string;
  message?: string;
}

export interface SensorSchemaNormalizationResult<TPayload> {
  payload: TPayload;
  issues: SensorSchemaIssue[];
}

export interface SensorSchema<TInput = unknown, TNormalized = TInput> {
  normalize(payload: TInput): SensorSchemaNormalizationResult<TNormalized> | TNormalized;
  fallback?: TNormalized;
}

export interface SensorAdapterSample<TPayload = unknown> {
  confidence: number;
  payload: TPayload;
}

export interface SensorAdapter<TPayload = unknown> {
  read(): Promise<SensorAdapterSample<TPayload> | void> | SensorAdapterSample<TPayload> | void;
  connect?(): Promise<void> | void;
  disconnect?(): Promise<void> | void;
  test?(): Promise<boolean> | boolean;
}

export interface TelemetryConsentMap {
  [classification: string]: boolean;
}

export interface TelemetryAuditEntry {
  event: string;
  payload: Record<string, unknown> | null;
  classification: string;
  timestamp: string;
  licenseKey?: string;
  source?: string;
}

export interface TelemetryRequestContext {
  endpoint: string;
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  events: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  provider: { id: string } & Record<string, unknown>;
}

export type TelemetryRequestMiddleware = (
  context: TelemetryRequestContext
) => Promise<Partial<TelemetryRequestContext> | void> | Partial<TelemetryRequestContext> | void;

export interface TelemetryConfig extends Record<string, unknown> {
  requestMiddleware?: TelemetryRequestMiddleware[];
  licenseAttestationProfiles?: LicenseAttestationProfile[];
  defaultLicenseAttestationProfileId?: string;
  licenseAttestationProfilePackId?: string;
  licenseAttestationProfilePackOptions?: LicenseAttestationProfilePackOptions;
  licenseAttestationProfilePacks?: Array<
    | string
    | LicenseAttestationProfilePackConfig
    | LicenseAttestationProfilePackDescriptor
  >;
  commercialization?: LicenseCommercializationOptions;
  commercializationReporter?: LicenseCommercializationReporter;
}

export interface AdaptiveTelemetryProviderFactoryContext {
  engine: any;
  telemetry: any;
  config: AdaptiveSDKConfig;
  options?: Record<string, unknown>;
  environment?: AdaptiveEnvironmentOptions;
}

export type AdaptiveTelemetryProviderFactoryResult =
  | any
  | any[]
  | Promise<any>
  | Promise<any[]>;

export type AdaptiveTelemetryProviderFactory = (
  context: AdaptiveTelemetryProviderFactoryContext
) => AdaptiveTelemetryProviderFactoryResult;

export interface AdaptiveTelemetryProviderDescriptorContext
  extends AdaptiveTelemetryProviderFactoryContext {
  descriptor: AdaptiveTelemetryProviderDescriptorObject;
  whenProvidersReady: () => Promise<void>;
  whenProviderReady: (
    selector?: AdaptiveTelemetryProviderReadySelector,
    options?: AdaptiveTelemetryProviderReadyOptions
  ) => Promise<AdaptiveTelemetryProviderReadyResult>;
  streamTelemetryProviders: <
    T = AdaptiveTelemetryProviderRegistrationEvent
  >(
    selector?: AdaptiveTelemetryProviderReadySelector,
    options?: AdaptiveTelemetryProviderStreamOptions
  ) => AdaptiveTelemetryProviderStream<T>;
}

export type AdaptiveTelemetryProviderResolver = (
  context: AdaptiveTelemetryProviderDescriptorContext
) => AdaptiveTelemetryProviderFactoryResult;

export type AdaptiveTelemetryProviderModuleLoader =
  | ((context: AdaptiveTelemetryProviderDescriptorContext) => Promise<any> | any)
  | Promise<any>
  | any;

export interface AdaptiveTelemetryProviderDescriptorObject {
  factory?: AdaptiveTelemetryProviderFactory;
  resolve?: AdaptiveTelemetryProviderResolver;
  module?: AdaptiveTelemetryProviderModuleLoader;
  guard?:
    | boolean
    | ((context: AdaptiveTelemetryProviderDescriptorContext) => boolean | Promise<boolean>);
  when?:
    | boolean
    | ((context: AdaptiveTelemetryProviderDescriptorContext) => boolean | Promise<boolean>);
  options?: Record<string, unknown>;
  providers?: AdaptiveTelemetryProviderDescriptor[];
  timeoutMs?: number;
  use?: AdaptiveTelemetryProviderDescriptor;
  tags?: string | string[] | Set<string> | Record<string, boolean>;
  bundle?: string;
  capabilities?: string | string[] | Set<string> | Record<string, boolean>;
}

export type AdaptiveTelemetryProviderDescriptor =
  | any
  | AdaptiveTelemetryProviderFactory
  | AdaptiveTelemetryProviderDescriptorObject;

export interface AdaptiveTelemetryProviderRegistrationEvent {
  provider: any;
  descriptor: AdaptiveTelemetryProviderDescriptorObject | null;
  entry: AdaptiveTelemetryProviderDescriptor | null;
  source: string;
  registrationSource?: string;
  options?: Record<string, unknown>;
  tags?: string[];
  bundle?: string | null;
  capabilities?: string[];
}

export interface AdaptiveTelemetryProviderRegistrationOptions {
  replace?: boolean;
  source?: string;
  registrationSource?: string;
  tags?: string | string[] | Set<string> | Record<string, boolean>;
  bundle?: string;
  capabilities?: string | string[] | Set<string> | Record<string, boolean>;
}

export interface AdaptiveTelemetryProviderReadyOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AdaptiveTelemetryProviderStreamOptions {
  includeExisting?: boolean;
  signal?: AbortSignal;
}

export type AdaptiveTelemetryProviderStream<
  T = AdaptiveTelemetryProviderRegistrationEvent
> = AsyncIterable<T>;

export interface AdaptiveTelemetryProviderReadySelectorCriteria {
  id?: string | string[];
  ids?: string[];
  providerId?: string | string[];
  providerIds?: string[];
  tag?: string;
  tags?: string | string[] | Set<string> | Record<string, boolean>;
  allTags?: string | string[] | Set<string> | Record<string, boolean>;
  requireTags?: string | string[] | Set<string> | Record<string, boolean>;
  anyTag?: string | string[] | Set<string> | Record<string, boolean>;
  anyTags?: string | string[] | Set<string> | Record<string, boolean>;
  someTags?: string | string[] | Set<string> | Record<string, boolean>;
  excludeTags?: string | string[] | Set<string> | Record<string, boolean>;
  excludedTags?: string | string[] | Set<string> | Record<string, boolean>;
  bundle?: string | string[] | Set<string> | Record<string, boolean>;
  bundles?: string | string[] | Set<string> | Record<string, boolean>;
  source?: string | string[] | Set<string> | Record<string, boolean>;
  sources?: string | string[] | Set<string> | Record<string, boolean>;
  registrationSource?: string | string[] | Set<string> | Record<string, boolean>;
  registrationSources?: string | string[] | Set<string> | Record<string, boolean>;
  capabilities?: string | string[] | Set<string> | Record<string, boolean>;
  allCapabilities?: string | string[] | Set<string> | Record<string, boolean>;
  requireCapabilities?: string | string[] | Set<string> | Record<string, boolean>;
  anyCapability?: string | string[] | Set<string> | Record<string, boolean>;
  anyCapabilities?: string | string[] | Set<string> | Record<string, boolean>;
  someCapabilities?: string | string[] | Set<string> | Record<string, boolean>;
  excludeCapabilities?: string | string[] | Set<string> | Record<string, boolean>;
  excludedCapabilities?: string | string[] | Set<string> | Record<string, boolean>;
  match?: (provider: any, event: AdaptiveTelemetryProviderRegistrationEvent) => unknown;
  where?: (provider: any, event: AdaptiveTelemetryProviderRegistrationEvent) => unknown;
  filter?: (provider: any, event: AdaptiveTelemetryProviderRegistrationEvent) => unknown;
  project?: (provider: any, event: AdaptiveTelemetryProviderRegistrationEvent) => unknown;
  select?: (provider: any, event: AdaptiveTelemetryProviderRegistrationEvent) => unknown;
  map?: (provider: any, event: AdaptiveTelemetryProviderRegistrationEvent) => unknown;
}

export type AdaptiveTelemetryProviderReadySelector =
  | string
  | { id: string }
  | RegExp
  | string[]
  | AdaptiveTelemetryProviderReadySelectorCriteria
  | ((
      provider: any,
      event: AdaptiveTelemetryProviderRegistrationEvent
    ) => unknown);

export type AdaptiveTelemetryProviderReadyResult =
  | AdaptiveTelemetryProviderRegistrationEvent
  | Array<AdaptiveTelemetryProviderRegistrationEvent | null>
  | unknown;

export interface LicenseDetails {
  key: string;
  tenantId?: string;
  features?: string[];
  expiresAt?: string | number | Date;
  issuedAt?: string | number | Date;
  signature?: string;
  metadata?: Record<string, unknown>;
}

export interface LicenseStatus {
  state: 'unregistered' | 'pending' | 'valid' | 'invalid' | 'expired';
  reason: string;
  validatedAt: string | null;
  metadata?: Record<string, unknown>;
  error?: string;
}

export type LicenseValidator = (
  license: LicenseDetails,
  context?: Record<string, unknown>
) =>
  | Promise<
      | { valid?: boolean; reason?: string; metadata?: Record<string, unknown> }
      | boolean
      | void
    >
  | { valid?: boolean; reason?: string; metadata?: Record<string, unknown> }
  | boolean
  | void;

export interface LicenseManagerOptions {
  clock?: () => Date | string | number;
  logger?: { warn?: (...args: unknown[]) => void };
  validators?: LicenseValidator[];
}

export interface LicenseConfig extends LicenseDetails {
  validators?: LicenseValidator[];
  autoValidate?: boolean;
  managerOptions?: Omit<LicenseManagerOptions, 'validators'>;
  attestor?: RemoteLicenseAttestor | RemoteLicenseAttestorOptions;
  attestorBinding?: RemoteLicenseAttestorBindingOptions;
  attestorProfileId?: string;
  attestorProfileOverrides?: LicenseAttestorProfileOverrides;
}

export interface RemoteLicenseAttestationMetadata {
  valid?: boolean;
  reason?: string;
  attestedAt?: string;
  nextCheckAt?: string | null;
  nextCheckInMs?: number | null;
  metadata?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
  skipped?: boolean;
}

export interface RemoteLicenseRevocationMetadata {
  revoked?: boolean;
  reason?: string;
  checkedAt?: string;
  metadata?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
  skipped?: boolean;
}

export interface RemoteLicenseEntitlementMetadata {
  entitlements?: string[];
  updatedAt?: string;
  ttlMs?: number | null;
  metadata?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
  skipped?: boolean;
}

export interface RemoteLicenseAttestationSummary {
  attestation?: RemoteLicenseAttestationMetadata;
  revocation?: RemoteLicenseRevocationMetadata;
  entitlements?: RemoteLicenseEntitlementMetadata;
}

export interface LicenseAttestationProfileSLA {
  failOpen?: boolean;
  responseTargetMs?: number;
  retryPolicy?: string;
  availability?: string;
  notes?: string;
  breachWindowMs?: number;
}

export interface LicenseAttestorProfileOverrides {
  attestorOptions?: Partial<RemoteLicenseAttestorOptions> & Record<string, unknown>;
  binding?: RemoteLicenseAttestorBindingOptions;
  metadata?: Record<string, unknown>;
  attestor?: RemoteLicenseAttestor;
}

export interface LicenseAttestationProfile {
  id: string;
  name?: string;
  description?: string;
  attestor?: RemoteLicenseAttestor | RemoteLicenseAttestorOptions;
  createAttestor?: (options: {
    profile: LicenseAttestationProfile;
    attestorOptions?: Record<string, unknown>;
    overrides?: LicenseAttestorProfileOverrides;
  }) => RemoteLicenseAttestor;
  binding?: RemoteLicenseAttestorBindingOptions;
  sla?: LicenseAttestationProfileSLA;
  metadata?: Record<string, unknown>;
}

export interface LicenseAttestationProfilePackOptions {
  regions?: string[];
  baseUrl?: string;
  pollIntervalMs?: number;
  minimumPollIntervalMs?: number;
  failOpen?: boolean;
  headers?: Record<string, string>;
  collaborationId?: string;
  projectCode?: string;
  defaultProfileId?: string;
  metadata?: Record<string, unknown>;
  applyDefault?: boolean;
  sla?: Partial<LicenseAttestationProfileSLA>;
}

export interface LicenseAttestationProfilePackDescriptor {
  id?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  defaults?: LicenseAttestationProfilePackOptions;
  profiles?: LicenseAttestationProfile[];
  buildProfiles?: (options?: LicenseAttestationProfilePackOptions) => LicenseAttestationProfile[];
}

export interface LicenseAttestationProfilePackConfig {
  id: string;
  options?: LicenseAttestationProfilePackOptions;
}

export interface LicenseAttestationProfilePackResult {
  id: string;
  name: string;
  description: string;
  defaultProfileId: string | null;
  profileIds: string[];
  metadata?: Record<string, unknown> | null;
}

export interface LicenseCommercializationMetricSummary {
  min: number;
  max: number;
  average: number;
}

export interface LicenseCommercializationSLASummary {
  responseTargetMs: LicenseCommercializationMetricSummary | null;
  availabilityPercent: LicenseCommercializationMetricSummary | null;
  breachWindowMs: LicenseCommercializationMetricSummary | null;
}

export interface LicenseCommercializationSegmentSummary {
  profileCount: number;
  packIds: string[];
  adoptionCount: number;
}

export interface LicenseCommercializationRegionSummary {
  profileCount: number;
  adoptionCount: number;
}

export interface LicenseCommercializationProfileSummary {
  id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sla?: LicenseAttestationProfileSLA;
  packId: string | null;
  registeredAt: string | null;
  source: string;
  adoptionCount: number;
  lastAppliedAt: string | null;
}

export interface LicenseCommercializationPackSummary {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  profileIds: string[];
  registeredAt: string | null;
  appliedDefault: boolean;
  defaultProfileId: string | null;
  adoptionCount: number;
  options?: Record<string, unknown> | null;
}

export interface LicenseCommercializationSummary {
  packs: LicenseCommercializationPackSummary[];
  profiles: LicenseCommercializationProfileSummary[];
  segments: Record<string, LicenseCommercializationSegmentSummary>;
  regions: Record<string, LicenseCommercializationRegionSummary>;
  sla: LicenseCommercializationSLASummary;
  defaultProfileId: string | null;
  lastUpdated: string | null;
}

export interface LicenseCommercializationSnapshotKpis {
  totalPacks: number;
  totalProfiles: number;
  totalAdoption: number;
  activePacks: number;
  activeProfiles: number;
  adoptionPerPack: number;
  adoptionPerProfile: number;
  segmentCount: number;
  regionCount: number;
  defaultProfileId: string | null;
  lastUpdated: string | null;
  topSegments: Array<{ key: string; adoption: number; profiles: number }>;
  topRegions: Array<{ key: string; adoption: number; profiles: number }>;
}

export interface LicenseCommercializationSnapshotContext extends Record<string, unknown> {
  trigger?: string;
  capturedBy?: string;
  licenseKey?: string;
  scheduledAt?: string;
}

export interface LicenseCommercializationSnapshot {
  id: string;
  capturedAt: string;
  summary?: LicenseCommercializationSummary;
  context: LicenseCommercializationSnapshotContext;
  kpis: LicenseCommercializationSnapshotKpis;
}

export interface LicenseCommercializationKpiReport {
  latest: LicenseCommercializationSnapshot | null;
  previous: LicenseCommercializationSnapshot | null;
  deltas: Record<string, number>;
}

export interface LicenseCommercializationReporterOptions {
  onUpdate?: (summary: LicenseCommercializationSummary) => void;
  emitProfileDetails?: boolean;
  enabled?: boolean;
}

export interface LicenseCommercializationSnapshotStorage {
  loadSnapshots?: () =>
    | LicenseCommercializationSnapshot[]
    | unknown[]
    | Promise<LicenseCommercializationSnapshot[] | unknown[]>;
  saveSnapshots?: (
    snapshots: LicenseCommercializationSnapshot[] | unknown[]
  ) => void | Promise<void>;
  appendSnapshot?: (
    snapshot: LicenseCommercializationSnapshot | unknown
  ) => void | Promise<void>;
  clearSnapshots?: () => void | Promise<void>;
}

export interface LicenseCommercializationSnapshotStoreOptions {
  maxSnapshots?: number;
  storage?: LicenseCommercializationSnapshotStorage;
  onChange?: (snapshots: LicenseCommercializationSnapshot[]) => void;
}

export interface CommercializationSnapshotTransformContext {
  includeSummary: boolean;
  redactContextKeys: string[];
}

export type CommercializationSnapshotTransform = (
  snapshot: LicenseCommercializationSnapshot | unknown,
  context: CommercializationSnapshotTransformContext
) => LicenseCommercializationSnapshot | Record<string, unknown> | null | undefined;

export interface CommercializationSnapshotRemoteStorageOptions {
  adapter: {
    write: (records: unknown[]) => void | Promise<void>;
    read?: () => unknown[] | Promise<unknown[]>;
    clear?: () => void | Promise<void>;
  };
  includeSummary?: boolean;
  redactContextKeys?: string[];
  transformSnapshot?: CommercializationSnapshotTransform;
  transformIncoming?: (
    records: unknown[],
    context: CommercializationSnapshotTransformContext
  ) => LicenseCommercializationSnapshot[];
  onError?: (error: unknown) => void;
}

export interface SignedS3CommercializationSnapshotStorageOptions
  extends SignedS3StorageAdapterOptions {
  includeSummary?: boolean;
  redactContextKeys?: string[];
  transformSnapshot?: CommercializationSnapshotTransform;
  transformIncoming?: (
    records: unknown[],
    context: CommercializationSnapshotTransformContext
  ) => LicenseCommercializationSnapshot[];
  onError?: (error: unknown) => void;
  serialize?: (
    snapshots: LicenseCommercializationSnapshot[],
    context: Record<string, unknown>
  ) => unknown;
}

export interface LogBrokerCommercializationSnapshotStorageOptions
  extends LogBrokerStorageAdapterOptions {
  includeSummary?: boolean;
  redactContextKeys?: string[];
  transformSnapshot?: CommercializationSnapshotTransform;
  transformIncoming?: (
    records: unknown[],
    context: CommercializationSnapshotTransformContext
  ) => LicenseCommercializationSnapshot[];
  onError?: (error: unknown) => void;
  serialize?: (
    snapshots: LicenseCommercializationSnapshot[],
    context: Record<string, unknown>
  ) => unknown;
}

export interface LicenseCommercializationOptions extends LicenseCommercializationReporterOptions {
  snapshotStore?: false | LicenseCommercializationSnapshotStore | LicenseCommercializationSnapshotStoreOptions;
  snapshotStoreOptions?: LicenseCommercializationSnapshotStoreOptions;
  snapshotIntervalMs?: number;
  captureInitialSnapshot?: boolean;
}

export interface LicenseAttestationProfileBindingResult {
  attestor: RemoteLicenseAttestor;
  binding: RemoteLicenseAttestorBindingOptions;
  profile: LicenseAttestationProfile;
}

export interface RemoteLicenseAttestorOptions {
  attestationUrl?: string;
  revocationUrl?: string;
  entitlementsUrl?: string;
  fetch?: (...args: unknown[]) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  headers?: Record<string, string>;
  pollIntervalMs?: number;
  minimumPollIntervalMs?: number;
  failOpen?: boolean;
  historyLimit?: number;
  clock?: () => Date | string | number;
  transformRequest?: (options: {
    type: string;
    payload: Record<string, unknown>;
    request?: Record<string, unknown>;
  }) => Record<string, unknown> | void;
  transformResponse?: (options: {
    type: string;
    response: unknown;
    text: string;
  }) => Record<string, unknown> | void;
}

export interface RemoteLicenseAttestorBindingOptions {
  bindToLicenseManager?: boolean;
  attestorOptions?: Record<string, unknown>;
}

export interface RemoteLicenseAttestorEvents {
  attestation: {
    license: LicenseDetails;
    context?: Record<string, unknown>;
    attestation: RemoteLicenseAttestationMetadata;
  };
  revocation: {
    license: LicenseDetails;
    context?: Record<string, unknown>;
    revocation: RemoteLicenseRevocationMetadata;
  };
  entitlements: {
    license: LicenseDetails;
    context?: Record<string, unknown>;
    entitlements: RemoteLicenseEntitlementMetadata;
  };
  validation: {
    license: LicenseDetails;
    context?: Record<string, unknown>;
    result: RemoteLicenseAttestationSummary;
  };
  error: {
    type: string;
    license?: LicenseDetails;
    context?: Record<string, unknown>;
    error: unknown;
  };
  schedule: {
    delayMs: number;
    context?: Record<string, unknown>;
  };
}

export interface AdaptiveEnvironmentOptions {
  mode?: 'browser' | 'headless' | string;
  skipVisualization?: boolean;
  skipUiBindings?: boolean;
  skipGallery?: boolean;
  skipExport?: boolean;
  skipStatus?: boolean;
  autoStart?: boolean;
}

export interface AdaptiveSDKConfig {
  sensory?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  telemetry?: TelemetryConfig;
  marketplaceHooks?: Record<string, unknown>;
  projection?: ProjectionConfig;
  environment?: AdaptiveEnvironmentOptions;
  layoutStrategies?: any[];
  layoutAnnotations?: any[];
  telemetryProviders?: AdaptiveTelemetryProviderDescriptor[];
  replaceDefaultProviders?: boolean;
  licenseAttestationProfiles?: LicenseAttestationProfile[];
  defaultLicenseAttestationProfileId?: string;
  licenseAttestorProfileId?: string;
  licenseAttestorProfileOverrides?: LicenseAttestorProfileOverrides;
  sensorSchemas?: Array<{ type: string; schema: SensorSchema }> | Record<string, SensorSchema>;
  sensorAdapters?: Array<{ type: string; instance: SensorAdapter; autoConnect?: boolean }>;
  telemetryConsent?: TelemetryConsentMap;
  consentOptions?: ConsentToggleOption[];
  licenseManager?: LicenseManager;
  license?: LicenseConfig;
  licenseAttestor?: RemoteLicenseAttestor | RemoteLicenseAttestorOptions;
  licenseAttestorBinding?: RemoteLicenseAttestorBindingOptions;
  commercialization?: LicenseCommercializationOptions;
  commercializationReporter?: LicenseCommercializationReporter;
}

export interface AdaptiveSDK {
  engine: any;
  sensoryBridge: any;
  layoutSynthesizer: any;
  telemetry: any;
  projectionComposer: ProjectionFieldComposer;
  projectionSimulator: ProjectionScenarioSimulator;
  licenseManager?: LicenseManager;
  licenseAttestor?: RemoteLicenseAttestor;
  registerLayoutStrategy(strategy: any): any;
  registerLayoutAnnotation(annotation: any): any;
  registerTelemetryProvider(provider: any): any;
  registerTelemetryProviders(
    entries: AdaptiveTelemetryProviderDescriptor | AdaptiveTelemetryProviderDescriptor[],
    options?: AdaptiveTelemetryProviderRegistrationOptions
  ): Promise<void>;
  registerTelemetryRequestMiddleware(middleware: TelemetryRequestMiddleware): any;
  clearTelemetryRequestMiddleware(): any;
  whenTelemetryProvidersReady(): Promise<void>;
  whenTelemetryProviderReady(
    selector?: AdaptiveTelemetryProviderReadySelector,
    options?: AdaptiveTelemetryProviderReadyOptions
  ): Promise<AdaptiveTelemetryProviderReadyResult>;
  streamTelemetryProviders<
    T = AdaptiveTelemetryProviderRegistrationEvent
  >(
    selector?: AdaptiveTelemetryProviderReadySelector,
    options?: AdaptiveTelemetryProviderStreamOptions
  ): AdaptiveTelemetryProviderStream<T>;
  onTelemetryProviderRegistered(
    listener: (event: AdaptiveTelemetryProviderRegistrationEvent) => void
  ): () => void;
  registerLicenseAttestationProfile(
    profile: LicenseAttestationProfile | string,
    options?: Omit<LicenseAttestationProfile, 'id'>
  ): LicenseAttestationProfile;
  registerLicenseAttestationProfilePack(
    pack: string | LicenseAttestationProfilePackDescriptor,
    options?: LicenseAttestationProfilePackOptions
  ): LicenseAttestationProfilePackResult;
  getLicenseAttestationProfiles(): LicenseAttestationProfile[];
  getLicenseAttestationProfile(id: string): LicenseAttestationProfile | null;
  setDefaultLicenseAttestationProfile(id: string): void;
  setLicenseAttestorFromProfile(
    profileId: string,
    overrides?: LicenseAttestorProfileOverrides
  ): LicenseAttestationProfileBindingResult;
  registerSensorSchema(type: string, schema: SensorSchema): any;
  registerSensorAdapter(type: string, adapter: SensorAdapter, options?: { autoConnect?: boolean }): any;
  connectSensorAdapter(type: string): Promise<void>;
  disconnectSensorAdapter(type: string): Promise<void>;
  testSensorAdapter(type: string): Promise<boolean | void>;
  updateTelemetryConsent(consent: TelemetryConsentMap, metadata?: Record<string, unknown>): void;
  getTelemetryConsent(): TelemetryConsentMap;
  getTelemetryAuditTrail(): TelemetryAuditEntry[];
  getLicenseCommercializationSummary(): LicenseCommercializationSummary;
  getLicenseCommercializationReporter(): LicenseCommercializationReporter | null;
  getLicenseCommercializationSnapshotStore(): LicenseCommercializationSnapshotStore | null;
  captureLicenseCommercializationSnapshot(
    context?: Record<string, unknown>
  ): LicenseCommercializationSnapshot | null;
  getLicenseCommercializationSnapshots(
    options?: LicenseCommercializationSnapshotQueryOptions
  ): LicenseCommercializationSnapshot[];
  getLicenseCommercializationKpiReport(options?: { limit?: number }): LicenseCommercializationKpiReport;
  exportLicenseCommercializationSnapshots(
    options?: LicenseCommercializationSnapshotExportOptions
  ): string | Record<string, unknown> | null;
  startLicenseCommercializationSnapshotSchedule(
    intervalMs?: number,
    context?: Record<string, unknown>
  ): (() => void) | null;
  stopLicenseCommercializationSnapshotSchedule(): void;
  setLicense(license: LicenseDetails): void;
  validateLicense(context?: Record<string, unknown>): Promise<LicenseStatus>;
  getLicenseStatus(): LicenseStatus;
  getLicenseHistory(): Array<{ status: LicenseStatus; timestamp: string }>;
  getLicenseAttestationHistory(): Array<{ timestamp: string; entry: RemoteLicenseAttestationSummary }>;
  setLicenseAttestor(attestor: RemoteLicenseAttestor | RemoteLicenseAttestorOptions | null, options?: RemoteLicenseAttestorBindingOptions): void;
  requestLicenseAttestation(context?: Record<string, unknown>): Promise<LicenseStatus>;
  onLicenseStatusChange(listener: (status: LicenseStatus) => void): () => void;
  createConsentPanel(options: ConsentPanelOptions): ConsentPanelApi;
  composeProjectionField(
    blueprintOrLayout: LayoutBlueprint | Record<string, unknown>,
    design?: Record<string, unknown>,
    context?: Record<string, unknown>,
    options?: ProjectionComposerOptions
  ): ProjectionFieldComposition | null;
  getProjectionFrame(): ProjectionScenarioFrame | null;
  stepProjectionSimulation(options?: { timestamp?: number }): ProjectionScenarioFrame | null;
  registerProjectionScenario(descriptor: ProjectionScenarioDescriptor): ProjectionScenarioDescriptor;
  removeProjectionScenario(id: string): boolean;
  listProjectionScenarios(): ProjectionScenarioDescriptor[];
  getProjectionScenario(id: string): ProjectionScenarioDescriptor | null;
  setActiveProjectionScenario(id: string): ProjectionScenarioDescriptor | null;
  getActiveProjectionScenario(): ProjectionScenarioDescriptor | null;
}

export interface ComplianceVaultStorageAdapter {
  read?(): TelemetryAuditEntry[] | Promise<TelemetryAuditEntry[]>;
  write?(records: TelemetryAuditEntry[]): void | Promise<void>;
  clear?(): void | Promise<void>;
}

export interface ComplianceVaultTelemetryProviderOptions {
  id?: string;
  metadata?: Record<string, unknown>;
  storageKey?: string;
  maxRecords?: number;
  includeClassifications?: string[];
  storageAdapter?: ComplianceVaultStorageAdapter;
}

export class ComplianceVaultTelemetryProvider {
  constructor(options?: ComplianceVaultTelemetryProviderOptions);
  id: string;
  metadata: Record<string, unknown>;
  getRecords(): TelemetryAuditEntry[];
  clear(): void;
  flush(): void;
  whenReady(): Promise<TelemetryAuditEntry[]>;
}

export interface ConsentToggleOption {
  classification: string;
  title: string;
  description: string;
}

export interface ConsentPanelOptions {
  container: HTMLElement;
  consentOptions?: ConsentToggleOption[];
  getTelemetryConsent?: () => TelemetryConsentMap;
  onConsentToggle?: (classification: string, enabled: boolean) => void;
  getComplianceRecords?: () => TelemetryAuditEntry[];
  getTelemetryAuditTrail?: () => TelemetryAuditEntry[];
  refreshInterval?: number;
  downloadFormatter?: (records: TelemetryAuditEntry[]) => string;
  downloadFileNamePrefix?: string;
  onDownload?: (options: { records: TelemetryAuditEntry[]; payload: unknown }) => void;
  onRender?: (options: { consent: TelemetryConsentMap; metadata?: Record<string, unknown> }) => void;
  trackConsentToggle?: (classification: string, enabled: boolean) => void;
  heading?: string;
}

export interface ConsentPanelApi {
  mount(): ConsentPanelApi;
  destroy(): void;
  refreshComplianceLog(): void;
  handleConsentDecision(consent: TelemetryConsentMap, metadata?: Record<string, unknown>): void;
}

export interface LayoutBlueprintZoneSummary {
  id: string;
  occupancy: number;
  layeringDepth: number;
  curvature: number;
  visibility: number;
  components: string[];
  surfaceScore: number;
}

export interface LayoutBlueprintMotionBias {
  x: number;
  y: number;
  z: number;
}

export interface LayoutBlueprintMotion {
  velocity: number;
  easing: string;
  bias: LayoutBlueprintMotionBias;
}

export interface LayoutBlueprint {
  generatedAt: string;
  intensity: number;
  engagementLevel: number;
  biometricStress: number;
  focusVector: { x: number; y: number; depth: number };
  motion: LayoutBlueprintMotion;
  pattern: Record<string, unknown> | null;
  monetization: Record<string, unknown> | null;
  integration: Record<string, unknown> | null;
  annotations: Array<Record<string, unknown>>;
  zones: LayoutBlueprintZoneSummary[];
  recommendedComponents: string[];
}

export interface ProjectionComposerOptions {
  resolution?: number;
  depthBands?: number;
  haloFalloff?: number;
  haloBaseRadius?: number;
  gestureWeight?: number;
  biasSmoothing?: number;
  bandEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface ProjectionFieldFocusHalo {
  radius: number;
  falloff: number;
  origin: { x: number; y: number; depth: number };
  stressPenalty: number;
  coherenceBoost: number;
}

export interface ProjectionFieldDepthBand {
  id: string;
  index: number;
  ratio: number;
  intensity: number;
  depth: number;
}

export interface ProjectionFieldGestureContour {
  id: string;
  orbit: number;
  curvature: number;
  visibility: number;
  intensity: number;
  zoneId: string;
  bias: { x: number; y: number; depth: number };
}

export interface ProjectionFieldInteractionLobe {
  id: string;
  volume: number;
  layeringDepth: number;
  visibility: number;
  saturation: number;
}

export interface ProjectionFieldAnnotationSummary {
  id: string;
  type: string;
  priority: number;
}

export interface ProjectionFieldComposition {
  generatedAt: string;
  options: ProjectionComposerOptions;
  focusHalo: ProjectionFieldFocusHalo;
  depthBands: ProjectionFieldDepthBand[];
  gestureContours: ProjectionFieldGestureContour[];
  interactionLobes: ProjectionFieldInteractionLobe[];
  activationMatrix: number[][];
  annotations: ProjectionFieldAnnotationSummary[];
  context: Record<string, unknown>;
  blueprint: LayoutBlueprint;
}

export interface ProjectionFieldComposerLayers {
  base?: HTMLCanvasElement | null;
  halo?: HTMLCanvasElement | null;
  bands?: HTMLCanvasElement | null;
  contours?: HTMLCanvasElement | null;
}

export interface ProjectionFieldComposerOptions extends ProjectionComposerOptions {
  layers?: ProjectionFieldComposerLayers;
  observe?: boolean;
}

export class ProjectionFieldComposer {
  constructor(options?: ProjectionFieldComposerOptions);
  compose(
    blueprint: LayoutBlueprint,
    context?: Record<string, unknown>,
    options?: ProjectionComposerOptions
  ): ProjectionFieldComposition;
  render(
    blueprint: LayoutBlueprint,
    context?: Record<string, unknown>,
    options?: ProjectionComposerOptions
  ): ProjectionFieldComposition;
  setOptions(options?: ProjectionComposerOptions): void;
  attachLayer(id: string, canvas: HTMLCanvasElement | null | undefined): void;
  detachLayer(id: string): void;
  resize(): void;
  clear(): void;
}

export function composeProjectionField(
  blueprint: LayoutBlueprint,
  context?: Record<string, unknown>,
  options?: ProjectionComposerOptions
): ProjectionFieldComposition;

export function createProjectionFieldComposer(
  options?: ProjectionFieldComposerOptions
): ProjectionFieldComposer;

export interface ProjectionScenarioAnchor {
  id?: string;
  label?: string;
  description?: string;
}

export interface ProjectionScenarioBlueprintModulation {
  intensity?: { start?: number; end?: number; easing?: string };
  engagementLevel?: { start?: number; end?: number; easing?: string };
  biometricStress?: { start?: number; end?: number; easing?: string };
  focusX?: { start?: number; end?: number; easing?: string };
  focusY?: { start?: number; end?: number; easing?: string };
  focusDepth?: { start?: number; end?: number; easing?: string };
  zoneOccupancy?: Array<{ id: string; start?: number; end?: number; easing?: string }>;
}

export interface ProjectionScenarioContextModulation {
  engagementLevel?: { start?: number; end?: number; easing?: string };
  gazeVelocity?: { start?: number; end?: number; easing?: string };
  neuralCoherence?: { start?: number; end?: number; easing?: string };
  hapticFeedback?: { start?: number; end?: number; easing?: string };
  gestureIntensity?: { start?: number; end?: number; easing?: string };
  gestureX?: { start?: number; end?: number; easing?: string };
  gestureY?: { start?: number; end?: number; easing?: string };
  gestureZ?: { start?: number; end?: number; easing?: string };
}

export interface ProjectionScenarioModulation {
  blueprint?: ProjectionScenarioBlueprintModulation;
  context?: ProjectionScenarioContextModulation;
  composerOptions?: ProjectionComposerOptions;
}

export interface ProjectionScenarioDescriptor {
  id: string;
  name?: string;
  description?: string;
  cycleMs?: number;
  blueprint?: LayoutBlueprint;
  context?: Record<string, unknown>;
  modulation?: ProjectionScenarioModulation;
  metadata?: Record<string, unknown>;
  anchors?: ProjectionScenarioAnchor[];
}

export interface ProjectionScenarioFrameAnchor extends ProjectionScenarioAnchor {
  progress: number;
}

export interface ProjectionScenarioFrame {
  id: string;
  name: string;
  progress: number;
  cycleMs: number;
  blueprint: LayoutBlueprint;
  context: Record<string, unknown>;
  composition: ProjectionFieldComposition;
  anchors: ProjectionScenarioFrameAnchor[];
}

export interface ProjectionScenarioSimulatorOptions {
  autoStart?: boolean;
  composer?: ProjectionFieldComposer;
}

export class ProjectionScenarioSimulator {
  constructor(options?: ProjectionScenarioSimulatorOptions);
  registerScenario(descriptor: ProjectionScenarioDescriptor): ProjectionScenarioDescriptor;
  removeScenario(id: string): boolean;
  listScenarios(): ProjectionScenarioDescriptor[];
  getScenario(id: string): ProjectionScenarioDescriptor | null;
  setActiveScenario(id: string): ProjectionScenarioDescriptor | null;
  getActiveScenario(): ProjectionScenarioDescriptor | null;
  observeAdaptiveState(state: {
    layout?: Record<string, unknown>;
    blueprint?: LayoutBlueprint;
    context?: Record<string, unknown>;
  }): void;
  step(options?: { timestamp?: number }): ProjectionScenarioFrame | null;
  compose(
    blueprint: LayoutBlueprint,
    context?: Record<string, unknown>,
    options?: ProjectionComposerOptions
  ): ProjectionFieldComposition;
  getLastResult(): ProjectionScenarioFrame | null;
  on(event: string, listener: (payload: unknown) => void): () => void;
}

export interface ProjectionConfig {
  composer?: ProjectionFieldComposerOptions;
  simulator?: ProjectionScenarioSimulatorOptions;
}

export interface LayoutBlueprintRendererLayers {
  [layerId: string]: HTMLCanvasElement | null | undefined;
}

export interface LayoutBlueprintRendererOptions {
  layers?: LayoutBlueprintRendererLayers;
  zoneColors?: Record<string, string>;
  background?: { inner?: string; outer?: string };
  devicePadding?: number;
  observe?: boolean;
}

export class LayoutBlueprintRenderer {
  constructor(options?: LayoutBlueprintRendererOptions);
  attachLayer(id: string, canvas: HTMLCanvasElement | null | undefined): void;
  detachLayer(id: string): void;
  resize(): void;
  clear(): void;
  render(layout: Record<string, unknown>, design?: Record<string, unknown>, context?: Record<string, unknown>): void;
}

export function createLayoutBlueprintRenderer(options?: LayoutBlueprintRendererOptions): LayoutBlueprintRenderer;

export function buildLayoutBlueprint(
  layout?: Record<string, unknown>,
  design?: Record<string, unknown>,
  context?: Record<string, unknown>
): LayoutBlueprint;

export interface RequestSigningMiddlewareOptions {
  signer: (
    payload: {
      endpoint: string;
      method: string;
      timestamp: string;
      body: string;
      events: Array<Record<string, unknown>>;
      digest: string;
      metadata: Record<string, unknown>;
    }
  ) => Promise<string | Record<string, unknown> | void> | string | Record<string, unknown> | void;
  header?: string;
  algorithmHeader?: string;
  timestampHeader?: string;
  includeEventDigest?: boolean;
  digestSeparator?: string;
  metadataKey?: string;
  algorithm?: string;
}

export function createRequestSigningMiddleware(
  options: RequestSigningMiddlewareOptions
): TelemetryRequestMiddleware;

export type RemoteStorageRetentionPolicy =
  | string
  | number
  | {
      strategy?: string;
      maxAgeMs?: number;
      legalHold?: boolean;
      deleteAfterUpload?: boolean;
      metadata?: Record<string, unknown>;
    };

export interface NormalizedRetentionPolicy {
  strategy: string;
  maxAgeMs?: number;
  legalHold?: boolean;
  deleteAfterUpload?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EncryptPayloadContext {
  adapter: string;
  records: TelemetryAuditEntry[];
  retentionPolicy?: NormalizedRetentionPolicy;
}

export type EncryptPayloadResult =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | {
      body?: string | ArrayBuffer | ArrayBufferView | Blob | Record<string, unknown>;
      contentType?: string;
      headers?: Record<string, string>;
      metadata?: Record<string, unknown>;
      useDefaultContentType?: boolean;
    };

export interface SignedS3StorageAdapterOptions {
  signingEndpoint: string;
  signingMethod?: string;
  signingHeaders?: Record<string, string>;
  signingPayload?: Record<string, unknown>;
  uploadMethod?: string;
  uploadHeaders?: Record<string, string>;
  fetchImplementation?: typeof fetch;
  serialize?: (
    records: TelemetryAuditEntry[],
    context: { retentionPolicy?: NormalizedRetentionPolicy }
  ) => string | object | ArrayBuffer | ArrayBufferView | Blob;
  retentionPolicy?: RemoteStorageRetentionPolicy;
  encryptPayload?: (
    payload: string | ArrayBuffer | ArrayBufferView | Blob,
    context: EncryptPayloadContext
  ) => Promise<EncryptPayloadResult> | EncryptPayloadResult;
  encryptionContentType?: string;
  onUploadComplete?: (info: {
    key?: string;
    location?: string;
    recordCount: number;
    retentionPolicy?: NormalizedRetentionPolicy;
    encryptionMetadata?: Record<string, unknown>;
  }) => void;
  onError?: (error: Error) => void;
  deleteEndpoint?: string;
  deleteMethod?: string;
}

export interface LogBrokerStorageAdapterOptions {
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  fetchImplementation?: typeof fetch;
  serialize?: (
    records: TelemetryAuditEntry[],
    context: { retentionPolicy?: NormalizedRetentionPolicy }
  ) => string | object | ArrayBuffer | ArrayBufferView | Blob;
  retentionPolicy?: RemoteStorageRetentionPolicy;
  encryptPayload?: (
    payload: string | ArrayBuffer | ArrayBufferView | Blob,
    context: EncryptPayloadContext
  ) => Promise<EncryptPayloadResult> | EncryptPayloadResult;
  encryptionContentType?: string;
  onError?: (error: Error) => void;
}

export interface RemoteStorageAdapter {
  write(records: TelemetryAuditEntry[]): Promise<void>;
  clear(): Promise<void | undefined>;
  read(): Promise<TelemetryAuditEntry[]>;
}

export class LicenseAttestationProfileRegistry {
  constructor(options?: { defaultProfileId?: string });
  hasProfile(id: string): boolean;
  registerProfile(
    profile: LicenseAttestationProfile | string,
    options?: Omit<LicenseAttestationProfile, 'id'>
  ): LicenseAttestationProfile;
  registerProfiles(profiles: LicenseAttestationProfile[]): LicenseAttestationProfile[];
  getProfile(id: string): LicenseAttestationProfile | null;
  getProfiles(): LicenseAttestationProfile[];
  setDefaultProfile(id: string): void;
  getDefaultProfileId(): string | null;
  clearDefaultProfile(): void;
  removeProfile(id: string): void;
  createAttestor(
    profileId?: string,
    overrides?: LicenseAttestorProfileOverrides
  ): LicenseAttestationProfileBindingResult;
}

export class LicenseManager {
  constructor(options?: LicenseManagerOptions);
  setLicense(license: LicenseDetails | null): LicenseStatus;
  clearLicense(): LicenseStatus;
  getLicense(): LicenseDetails | null;
  validate(context?: Record<string, unknown>): Promise<LicenseStatus>;
  registerValidator(validator: LicenseValidator): () => void;
  onStatusChange(listener: (status: LicenseStatus) => void): () => void;
  getStatus(): LicenseStatus;
  getValidationHistory(): Array<{ status: LicenseStatus; timestamp: string }>;
  hasFeature(feature: string): boolean;
  requireFeature(feature: string): void;
  isActive(): boolean;
}

export class RemoteLicenseAttestor {
  constructor(options?: RemoteLicenseAttestorOptions);
  getHistory(): Array<{ timestamp: string; entry: RemoteLicenseAttestationSummary }>;
  getLastResult(): RemoteLicenseAttestationSummary | null;
  createValidator(): LicenseValidator;
  bindToLicenseManager(manager: LicenseManager, options?: Record<string, unknown>): () => void;
  detach(): void;
  on<TEvent extends keyof RemoteLicenseAttestorEvents>(event: TEvent, listener: (payload: RemoteLicenseAttestorEvents[TEvent]) => void): () => void;
  off<TEvent extends keyof RemoteLicenseAttestorEvents>(event: TEvent, listener: (payload: RemoteLicenseAttestorEvents[TEvent]) => void): void;
}

export class LicenseCommercializationReporter {
  constructor(options?: LicenseCommercializationReporterOptions);
  recordPackRegistration(pack: Record<string, unknown>, context?: Record<string, unknown>): void;
  recordProfileRegistration(profile: LicenseAttestationProfile | Record<string, unknown>, context?: Record<string, unknown>): void;
  recordProfileApplied(profile: LicenseAttestationProfile | Record<string, unknown>, context?: Record<string, unknown>): void;
  recordDefaultProfileChange(profileId: string | null, context?: Record<string, unknown>): void;
  getPackIdForProfile(profileId: string): string | null;
  getSummary(): LicenseCommercializationSummary;
  addUpdateListener(listener: (summary: LicenseCommercializationSummary) => void): () => void;
  removeUpdateListener(listener: (summary: LicenseCommercializationSummary) => void): void;
}

export interface LicenseCommercializationSnapshotQueryOptions {
  limit?: number;
  withSummary?: boolean;
}

export interface LicenseCommercializationSnapshotExportOptions {
  format?: 'object' | 'json' | 'csv';
  includeSummary?: boolean;
  pretty?: boolean;
}

export class LicenseCommercializationSnapshotStore {
  constructor(options?: LicenseCommercializationSnapshotStoreOptions);
  recordSnapshot(summary: LicenseCommercializationSummary | LicenseCommercializationReporter, context?: Record<string, unknown>): LicenseCommercializationSnapshot;
  getSnapshots(options?: LicenseCommercializationSnapshotQueryOptions): LicenseCommercializationSnapshot[];
  getLatestSnapshot(): LicenseCommercializationSnapshot | null;
  getKpiReport(options?: { limit?: number }): LicenseCommercializationKpiReport;
  exportForBi(options?: LicenseCommercializationSnapshotExportOptions): string | Record<string, unknown> | null;
  clearSnapshots(): void;
  whenReady(): Promise<LicenseCommercializationSnapshot[]>;
}

export function createInMemoryCommercializationSnapshotStorage(initial?: LicenseCommercializationSnapshot[]): LicenseCommercializationSnapshotStorage;

export function createCommercializationSnapshotRemoteStorage(
  options: CommercializationSnapshotRemoteStorageOptions
): LicenseCommercializationSnapshotStorage;

export function createSignedS3CommercializationSnapshotStorage(
  options: SignedS3CommercializationSnapshotStorageOptions
): LicenseCommercializationSnapshotStorage;

export function createLogBrokerCommercializationSnapshotStorage(
  options: LogBrokerCommercializationSnapshotStorageOptions
): LicenseCommercializationSnapshotStorage;

export function createCommercializationSnapshotPayload(
  snapshots: LicenseCommercializationSnapshot[],
  context?: Record<string, unknown>
): Record<string, unknown>;

declare module './src/core/AdaptiveSDK.js' {
  export function createAdaptiveSDK(config?: AdaptiveSDKConfig): AdaptiveSDK;
}

declare module '../src/core/AdaptiveSDK.js' {
  export function createAdaptiveSDK(config?: AdaptiveSDKConfig): AdaptiveSDK;
}

declare module './src/ui/components/ConsentPanel.js' {
  export function createConsentPanel(options?: ConsentPanelOptions): ConsentPanelApi;
}

declare module '../src/ui/components/ConsentPanel.js' {
  export function createConsentPanel(options?: ConsentPanelOptions): ConsentPanelApi;
}

declare module './src/ui/adaptive/renderers/LayoutBlueprintRenderer.js' {
  export {
    LayoutBlueprintRenderer,
    createLayoutBlueprintRenderer,
    buildLayoutBlueprint,
    LayoutBlueprintRendererOptions,
    LayoutBlueprint,
    LayoutBlueprintZoneSummary,
    LayoutBlueprintMotion,
    LayoutBlueprintMotionBias,
  };
}

declare module '../src/ui/adaptive/renderers/LayoutBlueprintRenderer.js' {
  export {
    LayoutBlueprintRenderer,
    createLayoutBlueprintRenderer,
    buildLayoutBlueprint,
    LayoutBlueprintRendererOptions,
    LayoutBlueprint,
    LayoutBlueprintZoneSummary,
    LayoutBlueprintMotion,
    LayoutBlueprintMotionBias,
  };
}

declare module './src/ui/adaptive/renderers/ProjectionFieldComposer.js' {
  export {
    ProjectionFieldComposer,
    createProjectionFieldComposer,
    composeProjectionField,
    ProjectionFieldComposerOptions,
    ProjectionFieldComposition,
    ProjectionFieldFocusHalo,
    ProjectionFieldDepthBand,
    ProjectionFieldGestureContour,
    ProjectionFieldInteractionLobe,
    ProjectionFieldAnnotationSummary,
    ProjectionComposerOptions,
  };
}

declare module '../src/ui/adaptive/renderers/ProjectionFieldComposer.js' {
  export {
    ProjectionFieldComposer,
    createProjectionFieldComposer,
    composeProjectionField,
    ProjectionFieldComposerOptions,
    ProjectionFieldComposition,
    ProjectionFieldFocusHalo,
    ProjectionFieldDepthBand,
    ProjectionFieldGestureContour,
    ProjectionFieldInteractionLobe,
    ProjectionFieldAnnotationSummary,
    ProjectionComposerOptions,
  };
}

declare module './src/ui/adaptive/simulators/ProjectionScenarioSimulator.js' {
  export {
    ProjectionScenarioSimulator,
    ProjectionScenarioSimulatorOptions,
    ProjectionScenarioDescriptor,
    ProjectionScenarioFrame,
    ProjectionScenarioFrameAnchor,
    ProjectionScenarioModulation,
    ProjectionScenarioBlueprintModulation,
    ProjectionScenarioContextModulation,
    ProjectionScenarioAnchor,
  };
}

declare module '../src/ui/adaptive/simulators/ProjectionScenarioSimulator.js' {
  export {
    ProjectionScenarioSimulator,
    ProjectionScenarioSimulatorOptions,
    ProjectionScenarioDescriptor,
    ProjectionScenarioFrame,
    ProjectionScenarioFrameAnchor,
    ProjectionScenarioModulation,
    ProjectionScenarioBlueprintModulation,
    ProjectionScenarioContextModulation,
    ProjectionScenarioAnchor,
  };
}

declare module './src/product/telemetry/storage/RemoteStorageAdapters.js' {
  export function createSignedS3StorageAdapter(options: SignedS3StorageAdapterOptions): RemoteStorageAdapter;
  export function createLogBrokerStorageAdapter(options: LogBrokerStorageAdapterOptions): RemoteStorageAdapter;
}

declare module '../src/product/telemetry/storage/RemoteStorageAdapters.js' {
  export function createSignedS3StorageAdapter(options: SignedS3StorageAdapterOptions): RemoteStorageAdapter;
  export function createLogBrokerStorageAdapter(options: LogBrokerStorageAdapterOptions): RemoteStorageAdapter;
}

declare module './src/product/licensing/storage/CommercializationSnapshotStorageAdapters.js' {
  export {
    createCommercializationSnapshotRemoteStorage,
    createSignedS3CommercializationSnapshotStorage,
    createLogBrokerCommercializationSnapshotStorage,
    createCommercializationSnapshotPayload,
    CommercializationSnapshotRemoteStorageOptions,
    SignedS3CommercializationSnapshotStorageOptions,
    LogBrokerCommercializationSnapshotStorageOptions,
    CommercializationSnapshotTransform,
    CommercializationSnapshotTransformContext
  };
}

declare module '../src/product/licensing/storage/CommercializationSnapshotStorageAdapters.js' {
  export {
    createCommercializationSnapshotRemoteStorage,
    createSignedS3CommercializationSnapshotStorage,
    createLogBrokerCommercializationSnapshotStorage,
    createCommercializationSnapshotPayload,
    CommercializationSnapshotRemoteStorageOptions,
    SignedS3CommercializationSnapshotStorageOptions,
    LogBrokerCommercializationSnapshotStorageOptions,
    CommercializationSnapshotTransform,
    CommercializationSnapshotTransformContext
  };
}

declare module './src/product/licensing/LicenseManager.js' {
  export {
    LicenseManager,
    LicenseManagerOptions,
    LicenseStatus,
    LicenseDetails,
    LicenseValidator,
    RemoteLicenseAttestor,
    RemoteLicenseAttestorOptions,
    RemoteLicenseAttestationSummary,
    RemoteLicenseAttestorBindingOptions,
    LicenseAttestationProfileRegistry,
    LicenseAttestationProfile,
    LicenseAttestationProfileBindingResult,
    LicenseAttestationProfileSLA,
    LicenseAttestorProfileOverrides,
    LicenseAttestationProfilePackOptions,
    LicenseAttestationProfilePackDescriptor,
    LicenseAttestationProfilePackConfig,
    LicenseAttestationProfilePackResult,
    LicenseCommercializationReporter,
    LicenseCommercializationSummary,
    LicenseCommercializationOptions,
    LicenseCommercializationReporterOptions,
    LicenseCommercializationPackSummary,
    LicenseCommercializationProfileSummary,
    LicenseCommercializationSegmentSummary,
    LicenseCommercializationRegionSummary,
    LicenseCommercializationSLASummary,
    LicenseCommercializationMetricSummary,
    LicenseCommercializationSnapshot,
    LicenseCommercializationSnapshotKpis,
    LicenseCommercializationKpiReport,
    LicenseCommercializationSnapshotQueryOptions,
    LicenseCommercializationSnapshotExportOptions,
    LicenseCommercializationSnapshotStore,
    LicenseCommercializationSnapshotStoreOptions,
    LicenseCommercializationSnapshotStorage,
    CommercializationSnapshotRemoteStorageOptions,
    SignedS3CommercializationSnapshotStorageOptions,
    LogBrokerCommercializationSnapshotStorageOptions,
    CommercializationSnapshotTransform,
    CommercializationSnapshotTransformContext,
    createInMemoryCommercializationSnapshotStorage,
    createCommercializationSnapshotRemoteStorage,
    createSignedS3CommercializationSnapshotStorage,
    createLogBrokerCommercializationSnapshotStorage,
    createCommercializationSnapshotPayload
  };
}

declare module '../src/product/licensing/LicenseManager.js' {
  export {
    LicenseManager,
    LicenseManagerOptions,
    LicenseStatus,
    LicenseDetails,
    LicenseValidator,
    RemoteLicenseAttestor,
    RemoteLicenseAttestorOptions,
    RemoteLicenseAttestationSummary,
    RemoteLicenseAttestorBindingOptions,
    LicenseAttestationProfileRegistry,
    LicenseAttestationProfile,
    LicenseAttestationProfileBindingResult,
    LicenseAttestationProfileSLA,
    LicenseAttestorProfileOverrides,
    LicenseAttestationProfilePackOptions,
    LicenseAttestationProfilePackDescriptor,
    LicenseAttestationProfilePackConfig,
    LicenseAttestationProfilePackResult,
    LicenseCommercializationReporter,
    LicenseCommercializationSummary,
    LicenseCommercializationOptions,
    LicenseCommercializationReporterOptions,
    LicenseCommercializationPackSummary,
    LicenseCommercializationProfileSummary,
    LicenseCommercializationSegmentSummary,
    LicenseCommercializationRegionSummary,
    LicenseCommercializationSLASummary,
    LicenseCommercializationMetricSummary,
    LicenseCommercializationSnapshot,
    LicenseCommercializationSnapshotKpis,
    LicenseCommercializationKpiReport,
    LicenseCommercializationSnapshotQueryOptions,
    LicenseCommercializationSnapshotExportOptions,
    LicenseCommercializationSnapshotStore,
    LicenseCommercializationSnapshotStoreOptions,
    LicenseCommercializationSnapshotStorage,
    CommercializationSnapshotRemoteStorageOptions,
    SignedS3CommercializationSnapshotStorageOptions,
    LogBrokerCommercializationSnapshotStorageOptions,
    CommercializationSnapshotTransform,
    CommercializationSnapshotTransformContext,
    createInMemoryCommercializationSnapshotStorage,
    createCommercializationSnapshotRemoteStorage,
    createSignedS3CommercializationSnapshotStorage,
    createLogBrokerCommercializationSnapshotStorage,
    createCommercializationSnapshotPayload
  };
}
