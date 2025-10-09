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

export interface AdaptiveSDKConfig {
  sensory?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  telemetry?: TelemetryConfig;
  marketplaceHooks?: Record<string, unknown>;
  blueprintInsights?:
    | LayoutBlueprintInsightEngine
    | LayoutBlueprintInsightEngineOptions
    | false;
  blueprintScenarios?:
    | LayoutBlueprintScenarioSimulator
    | LayoutBlueprintScenarioSimulatorOptions
    | false;
  blueprintCalibration?:
    | LayoutBlueprintCalibrationEngine
    | LayoutBlueprintCalibrationEngineOptions
    | false;
  blueprintEvolution?:
    | LayoutBlueprintEvolutionEngine
    | LayoutBlueprintEvolutionOptions
    | false;
  layoutStrategies?: any[];
  layoutAnnotations?: any[];
  telemetryProviders?: any[];
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
  licenseManager?: LicenseManager;
  licenseAttestor?: RemoteLicenseAttestor;
  registerLayoutStrategy(strategy: any): any;
  registerLayoutAnnotation(annotation: any): any;
  registerTelemetryProvider(provider: any): any;
  registerTelemetryRequestMiddleware(middleware: TelemetryRequestMiddleware): any;
  clearTelemetryRequestMiddleware(): any;
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
  generateLayoutBlueprintSnapshot(options?: LayoutBlueprintSnapshotOptions): LayoutBlueprintSnapshotResult;
  generateLayoutBlueprintScenario(
    options?: LayoutBlueprintScenarioOptions
  ): LayoutBlueprintScenarioResult;
  runLayoutBlueprintEvolution(
    options?: LayoutBlueprintEvolutionRunOptions
  ): LayoutBlueprintEvolutionResult | null;
  calibrateLayoutBlueprint(
    options?: LayoutBlueprintCalibrationOptions
  ): LayoutBlueprintCalibrationResult | null;
  getLayoutBlueprintInsightHistory(): LayoutBlueprintInsightSnapshot[];
  clearLayoutBlueprintInsightHistory(): void;
  getLayoutBlueprintScenarioHistory(): LayoutBlueprintScenarioHistoryEntry[];
  clearLayoutBlueprintScenarioHistory(): void;
  getLayoutBlueprintCalibrationHistory(): LayoutBlueprintCalibrationHistoryEntry[];
  clearLayoutBlueprintCalibrationHistory(): void;
  getLayoutBlueprintEvolutionHistory(): LayoutBlueprintEvolutionHistoryEntry[];
  clearLayoutBlueprintEvolutionHistory(): void;
  readonly blueprintInsightEngine: LayoutBlueprintInsightEngine | null;
  readonly blueprintCalibrationEngine: LayoutBlueprintCalibrationEngine | null;
  readonly blueprintEvolutionEngine: LayoutBlueprintEvolutionEngine | null;
  createConsentPanel(options: ConsentPanelOptions): ConsentPanelApi;
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
  analytics: LayoutBlueprintAnalytics;
}

export interface LayoutBlueprintAnalytics {
  zoneBalanceScore: number;
  focusReliability: number;
  stressRisk: number;
  motionStability: number;
  statusTags: string[];
  recommendations: string[];
}

export interface LayoutBlueprintTrend {
  direction: 'improving' | 'declining' | 'mixed' | 'stable';
  deltas: {
    zoneBalanceScore: number;
    focusReliability: number;
    stressRisk: number;
    motionStability: number;
  };
}

export interface LayoutBlueprintInsightSummary {
  zoneCount: number;
  recommendedComponentCount: number;
  engagementLevel: number | null | undefined;
  biometricStress: number | null | undefined;
}

export interface LayoutBlueprintInsightSnapshot {
  id: string;
  generatedAt: string;
  analytics: LayoutBlueprintAnalytics;
  statusTags: string[];
  recommendations: string[];
  summary: LayoutBlueprintInsightSummary;
  focusVector: { x: number; y: number; depth: number };
  motion: LayoutBlueprintMotion;
}

export interface LayoutBlueprintInsightResult {
  blueprint: LayoutBlueprint;
  analytics: LayoutBlueprintAnalytics;
  recommendations: string[];
  statusTags: string[];
  trend: LayoutBlueprintTrend;
  history: LayoutBlueprintInsightSnapshot[];
}

export interface LayoutBlueprintInsightAnalyzeOptions {
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  context?: Record<string, unknown>;
  id?: string;
  storeHistory?: boolean;
}

export interface LayoutBlueprintSnapshotOptions {
  context?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  id?: string;
  useActiveLayout?: boolean;
  storeHistory?: boolean;
  analyze?: boolean;
}

export interface LayoutBlueprintSnapshotResult {
  blueprint: LayoutBlueprint;
  insights: LayoutBlueprintInsightResult | null;
}

export interface LayoutBlueprintScenarioAnomaly {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface LayoutBlueprintScenarioAggregate {
  averageZoneBalance: number;
  averageFocusReliability: number;
  averageStressRisk: number;
  averageMotionStability: number;
  peakStressRisk: number;
  lowestMotionStability: number;
  scenarioConfidence: number;
  anomalyCount: number;
  dwellDurationMs: number;
}

export interface LayoutBlueprintScenarioStepConfig {
  id?: string;
  context?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  dwellMs?: number;
  notes?: string;
  useActiveLayout?: boolean;
}

export interface LayoutBlueprintScenarioStepResult {
  id: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  context: Record<string, unknown>;
  blueprint: LayoutBlueprint;
  analytics: LayoutBlueprintAnalytics;
  recommendations: string[];
  statusTags: string[];
  anomalies: LayoutBlueprintScenarioAnomaly[];
  notes: string | null;
}

export interface LayoutBlueprintScenarioResult {
  scenarioId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  steps: LayoutBlueprintScenarioStepResult[];
  aggregate: LayoutBlueprintScenarioAggregate;
  recommendations: string[];
  statusTags: string[];
  anomalies: LayoutBlueprintScenarioAnomaly[];
}

export interface LayoutBlueprintScenarioHistoryStepSummary {
  id: string;
  analytics: LayoutBlueprintAnalytics;
  statusTags: string[];
  recommendations: string[];
}

export interface LayoutBlueprintScenarioHistoryEntry {
  id: string;
  startedAt: number;
  completedAt: number;
  aggregate: LayoutBlueprintScenarioAggregate;
  recommendations: string[];
  statusTags: string[];
  anomalies: LayoutBlueprintScenarioAnomaly[];
  steps: LayoutBlueprintScenarioHistoryStepSummary[];
}

export interface LayoutBlueprintScenarioOptions {
  id?: string;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  contextDefaults?: Record<string, unknown>;
  steps?: LayoutBlueprintScenarioStepConfig[];
  useActiveLayout?: boolean;
  storeStepHistory?: boolean;
}

export interface LayoutBlueprintEvolutionAdjustment {
  type: string;
  target: string;
  change: number;
  summary?: string;
  tags?: string[];
}

export interface LayoutBlueprintEvolutionVariant {
  id: string;
  title: string;
  strategyId: string;
  rationale?: string;
  recommendations: string[];
  tags: string[];
  adjustments: LayoutBlueprintEvolutionAdjustment[];
  analytics: LayoutBlueprintAnalytics;
  analyticsDelta: {
    zoneBalanceScore: number;
    focusReliability: number;
    stressRisk: number;
    motionStability: number;
  };
  score: number;
  scoreDelta: number;
  blueprint: LayoutBlueprint;
  generatedAt: string;
  weight: number;
  error?: string;
  failed?: boolean;
}

export interface LayoutBlueprintEvolutionAggregate {
  variantCount: number;
  baseScore: number;
  recommendedVariantId: string | null;
  recommendedScore?: number;
  weightedScore?: number;
  tags: string[];
  recommendations: string[];
  averageScoreDelta: number;
}

export interface LayoutBlueprintEvolutionResult {
  id: string;
  generatedAt: string;
  blueprint: LayoutBlueprint;
  variants: LayoutBlueprintEvolutionVariant[];
  aggregate: LayoutBlueprintEvolutionAggregate;
}

export type LayoutBlueprintEvolutionHistoryEntry = LayoutBlueprintEvolutionResult;

export interface LayoutBlueprintEvolutionStrategyGenerateContext {
  blueprint: LayoutBlueprint;
  layout: Record<string, unknown>;
  design: Record<string, unknown>;
  context: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface LayoutBlueprintEvolutionStrategyResult {
  id?: string;
  title?: string;
  rationale?: string;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  context?: Record<string, unknown>;
  recommendations?: string[];
  tags?: string[];
  adjustments?: LayoutBlueprintEvolutionAdjustment[];
  weight?: number;
}

export interface LayoutBlueprintEvolutionStrategy {
  id: string;
  title?: string;
  description?: string;
  weight?: number;
  generate(context: LayoutBlueprintEvolutionStrategyGenerateContext):
    | LayoutBlueprintEvolutionStrategyResult
    | null
    | undefined;
}

export interface LayoutBlueprintEvolutionOptions {
  defaults?: boolean;
  historyLimit?: number;
  insightEngine?: LayoutBlueprintInsightEngine | null;
}

export interface LayoutBlueprintEvolutionRunOptions {
  id?: string;
  blueprint?: LayoutBlueprint;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  context?: Record<string, unknown>;
  refreshSnapshot?: boolean;
  useActiveLayout?: boolean;
  analyze?: boolean;
  storeInsightHistory?: boolean;
  strategyOptions?: Record<string, unknown>;
  snapshotId?: string;
}

export class LayoutBlueprintEvolutionEngine {
  constructor(options?: LayoutBlueprintEvolutionOptions);
  registerStrategy(strategy: LayoutBlueprintEvolutionStrategy): this;
  removeStrategy(id: string): this;
  clearStrategies(): this;
  getStrategies(): LayoutBlueprintEvolutionStrategy[];
  evolve(options?: LayoutBlueprintEvolutionRunOptions): LayoutBlueprintEvolutionResult | null;
  getHistory(): LayoutBlueprintEvolutionHistoryEntry[];
  clearHistory(): void;
}

export function createLayoutBlueprintEvolutionEngine(
  options?: LayoutBlueprintEvolutionOptions
): LayoutBlueprintEvolutionEngine;

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

export interface LayoutBlueprintScenarioSimulatorOptions {
  insightEngine?: LayoutBlueprintInsightEngine | null;
  maxSteps?: number;
  defaultStepWeight?: number;
}

export class LayoutBlueprintScenarioSimulator {
  constructor(options?: LayoutBlueprintScenarioSimulatorOptions);
  runScenario(options?: LayoutBlueprintScenarioOptions): LayoutBlueprintScenarioResult;
}

export function createLayoutBlueprintScenarioSimulator(
  options?: LayoutBlueprintScenarioSimulatorOptions
): LayoutBlueprintScenarioSimulator;

export type LayoutBlueprintCalibrationPriority = 'high' | 'medium' | 'low';

export interface LayoutBlueprintCalibrationAdjustment {
  type: string;
  target: string;
  change?: number;
  summary?: string;
  tags?: string[];
}

export interface LayoutBlueprintCalibrationResultEntry {
  id: string;
  title: string;
  rationale: string;
  score: number;
  priority: LayoutBlueprintCalibrationPriority;
  tags: string[];
  adjustments: LayoutBlueprintCalibrationAdjustment[];
  expectedImpact?: Record<string, number> | null;
}

export interface LayoutBlueprintCalibrationAggregate {
  calibrationCount: number;
  averageScore: number;
  highestPriority: LayoutBlueprintCalibrationPriority;
  adjustments: Array<
    LayoutBlueprintCalibrationAdjustment & {
      recommendations: number;
      aggregateChange: number;
      summaries: string[];
    }
  >;
  tags: string[];
  nextActions: Array<{
    id: string;
    title: string;
    priority: LayoutBlueprintCalibrationPriority;
    summary: string;
  }>;
}

export interface LayoutBlueprintCalibrationResult {
  id: string;
  generatedAt: number;
  blueprint: {
    analytics: LayoutBlueprintAnalytics;
    summary: {
      zoneCount: number;
      engagementLevel?: number;
      biometricStress?: number;
    };
  };
  calibrations: LayoutBlueprintCalibrationResultEntry[];
  aggregate: LayoutBlueprintCalibrationAggregate;
  annotations?: Record<string, unknown>[];
}

export type LayoutBlueprintCalibrationHistoryEntry = LayoutBlueprintCalibrationResult;

export interface LayoutBlueprintCalibrationOptions {
  id?: string;
  blueprint?: LayoutBlueprint;
  insights?: LayoutBlueprintAnalytics | LayoutBlueprintInsightResult | null;
  scenario?: LayoutBlueprintScenarioResult | Record<string, unknown> | null;
  context?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  useActiveLayout?: boolean;
  analyze?: boolean;
  refreshSnapshot?: boolean;
  storeHistory?: boolean;
  storeInsightHistory?: boolean;
  annotations?: Record<string, unknown>[];
}

export interface LayoutBlueprintCalibratorContext {
  blueprint: LayoutBlueprint;
  insights?: LayoutBlueprintAnalytics | LayoutBlueprintInsightResult | null;
  scenario?: LayoutBlueprintScenarioResult | Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
}

export interface LayoutBlueprintCalibrator {
  id: string;
  title: string;
  description?: string;
  priority?: LayoutBlueprintCalibrationPriority;
  tags?: string[];
  evaluate(
    context: LayoutBlueprintCalibratorContext
  ): Omit<LayoutBlueprintCalibrationResultEntry, 'priority' | 'tags'> & {
    priority?: LayoutBlueprintCalibrationPriority;
    tags?: string[];
  } | null;
}

export interface LayoutBlueprintCalibrationEngineOptions {
  insightEngine?: LayoutBlueprintInsightEngine | null;
  historyLimit?: number;
  defaults?: LayoutBlueprintCalibrator[] | false;
}

export class LayoutBlueprintCalibrationEngine {
  constructor(options?: LayoutBlueprintCalibrationEngineOptions);
  registerCalibrator(calibrator: LayoutBlueprintCalibrator): this;
  removeCalibrator(id: string): this;
  clearCalibrators(): this;
  listCalibrators(): Array<{
    id: string;
    title: string;
    description?: string;
    priority?: LayoutBlueprintCalibrationPriority;
    tags?: string[];
  }>;
  calibrate(options?: LayoutBlueprintCalibrationOptions): LayoutBlueprintCalibrationResult | null;
  getHistory(): LayoutBlueprintCalibrationHistoryEntry[];
  clearHistory(): void;
}

export function createLayoutBlueprintCalibrationEngine(
  options?: LayoutBlueprintCalibrationEngineOptions
): LayoutBlueprintCalibrationEngine;

export interface LayoutBlueprintInsightEngineOptions {
  historyLimit?: number;
  scenarioHistoryLimit?: number;
  calibrationHistoryLimit?: number;
}

export class LayoutBlueprintInsightEngine {
  constructor(options?: LayoutBlueprintInsightEngineOptions);
  analyze(
    blueprintOrLayout: LayoutBlueprint | Record<string, unknown>,
    options?: LayoutBlueprintInsightAnalyzeOptions
  ): LayoutBlueprintInsightResult | null;
  computeTrend(
    current?: LayoutBlueprintAnalytics,
    previous?: LayoutBlueprintAnalytics | null
  ): LayoutBlueprintTrend;
  getHistory(): LayoutBlueprintInsightSnapshot[];
  clearHistory(): void;
  recordScenarioResult(result: {
    id?: string;
    startedAt?: number;
    completedAt?: number;
    aggregate?: LayoutBlueprintScenarioAggregate;
    recommendations?: string[];
    statusTags?: string[];
    anomalies?: LayoutBlueprintScenarioAnomaly[];
    steps?: LayoutBlueprintScenarioHistoryStepSummary[];
  }): LayoutBlueprintScenarioHistoryEntry | null;
  getScenarioHistory(): LayoutBlueprintScenarioHistoryEntry[];
  clearScenarioHistory(): void;
  recordCalibrationResult(result: LayoutBlueprintCalibrationResult | null):
    | LayoutBlueprintCalibrationHistoryEntry
    | null;
  getCalibrationHistory(): LayoutBlueprintCalibrationHistoryEntry[];
  clearCalibrationHistory(): void;
}

export function createLayoutBlueprintInsightEngine(
  options?: LayoutBlueprintInsightEngineOptions
): LayoutBlueprintInsightEngine;

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

declare module './src/ui/adaptive/renderers/LayoutBlueprintScenarioSimulator.js' {
  export {
    LayoutBlueprintScenarioSimulator,
    LayoutBlueprintScenarioSimulatorOptions,
    createLayoutBlueprintScenarioSimulator,
    LayoutBlueprintScenarioOptions,
    LayoutBlueprintScenarioResult,
    LayoutBlueprintScenarioStepResult,
    LayoutBlueprintScenarioAggregate,
    LayoutBlueprintScenarioAnomaly,
    LayoutBlueprintScenarioHistoryEntry,
  };
}

declare module '../src/ui/adaptive/renderers/LayoutBlueprintScenarioSimulator.js' {
  export {
    LayoutBlueprintScenarioSimulator,
    LayoutBlueprintScenarioSimulatorOptions,
    createLayoutBlueprintScenarioSimulator,
    LayoutBlueprintScenarioOptions,
    LayoutBlueprintScenarioResult,
    LayoutBlueprintScenarioStepResult,
    LayoutBlueprintScenarioAggregate,
    LayoutBlueprintScenarioAnomaly,
    LayoutBlueprintScenarioHistoryEntry,
  };
}

declare module './src/ui/adaptive/renderers/LayoutBlueprintInsightEngine.js' {
  export {
    LayoutBlueprintInsightEngine,
    LayoutBlueprintInsightEngineOptions,
    createLayoutBlueprintInsightEngine,
    LayoutBlueprintInsightResult,
    LayoutBlueprintInsightSnapshot,
    LayoutBlueprintTrend,
  };
}

declare module '../src/ui/adaptive/renderers/LayoutBlueprintInsightEngine.js' {
  export {
    LayoutBlueprintInsightEngine,
    LayoutBlueprintInsightEngineOptions,
    createLayoutBlueprintInsightEngine,
    LayoutBlueprintInsightResult,
    LayoutBlueprintInsightSnapshot,
    LayoutBlueprintTrend,
  };
}

declare module './src/ui/adaptive/renderers/LayoutBlueprintCalibrationEngine.js' {
  export {
    LayoutBlueprintCalibrationEngine,
    LayoutBlueprintCalibrationEngineOptions,
    createLayoutBlueprintCalibrationEngine,
    LayoutBlueprintCalibrationOptions,
    LayoutBlueprintCalibrationResult,
    LayoutBlueprintCalibrationHistoryEntry,
    LayoutBlueprintCalibrationAggregate,
    LayoutBlueprintCalibrationResultEntry,
    LayoutBlueprintCalibrationAdjustment,
    LayoutBlueprintCalibrator,
    LayoutBlueprintCalibratorContext,
    LayoutBlueprintCalibrationPriority,
  };
}

declare module '../src/ui/adaptive/renderers/LayoutBlueprintCalibrationEngine.js' {
declare module './src/ui/adaptive/renderers/LayoutBlueprintEvolutionEngine.js' {
  export {
    LayoutBlueprintEvolutionEngine,
    LayoutBlueprintEvolutionOptions,
    LayoutBlueprintEvolutionRunOptions,
    LayoutBlueprintEvolutionVariant,
    LayoutBlueprintEvolutionAggregate,
    LayoutBlueprintEvolutionResult,
    LayoutBlueprintEvolutionHistoryEntry,
    LayoutBlueprintEvolutionStrategy,
    LayoutBlueprintEvolutionStrategyResult,
    LayoutBlueprintEvolutionStrategyGenerateContext,
    LayoutBlueprintEvolutionAdjustment,
    createLayoutBlueprintEvolutionEngine,
  };
}

declare module '../src/ui/adaptive/renderers/LayoutBlueprintEvolutionEngine.js' {
  export {
    LayoutBlueprintEvolutionEngine,
    LayoutBlueprintEvolutionOptions,
    LayoutBlueprintEvolutionRunOptions,
    LayoutBlueprintEvolutionVariant,
    LayoutBlueprintEvolutionAggregate,
    LayoutBlueprintEvolutionResult,
    LayoutBlueprintEvolutionHistoryEntry,
    LayoutBlueprintEvolutionStrategy,
    LayoutBlueprintEvolutionStrategyResult,
    LayoutBlueprintEvolutionStrategyGenerateContext,
    LayoutBlueprintEvolutionAdjustment,
    createLayoutBlueprintEvolutionEngine,
  };
}

  export {
    LayoutBlueprintCalibrationEngine,
    LayoutBlueprintCalibrationEngineOptions,
    createLayoutBlueprintCalibrationEngine,
    LayoutBlueprintCalibrationOptions,
    LayoutBlueprintCalibrationResult,
    LayoutBlueprintCalibrationHistoryEntry,
    LayoutBlueprintCalibrationAggregate,
    LayoutBlueprintCalibrationResultEntry,
    LayoutBlueprintCalibrationAdjustment,
    LayoutBlueprintCalibrator,
    LayoutBlueprintCalibratorContext,
    LayoutBlueprintCalibrationPriority,
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
