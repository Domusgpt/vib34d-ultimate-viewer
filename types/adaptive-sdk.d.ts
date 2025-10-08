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
  seedLicenseAttestationProfileIds?: string[];
  useDefaultLicenseAttestationProfiles?: boolean;
  overrideSeedLicenseAttestationProfiles?: boolean;
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
  layoutStrategies?: any[];
  layoutAnnotations?: any[];
  telemetryProviders?: any[];
  replaceDefaultProviders?: boolean;
  licenseAttestationProfiles?: LicenseAttestationProfile[];
  defaultLicenseAttestationProfileId?: string;
  seedLicenseAttestationProfileIds?: string[];
  licenseAttestorProfileId?: string;
  licenseAttestorProfileOverrides?: LicenseAttestorProfileOverrides;
  useDefaultLicenseAttestationProfiles?: boolean;
  overrideSeedLicenseAttestationProfiles?: boolean;
  sensorSchemas?: Array<{ type: string; schema: SensorSchema }> | Record<string, SensorSchema>;
  sensorAdapters?: Array<{ type: string; instance: SensorAdapter; autoConnect?: boolean }>;
  telemetryConsent?: TelemetryConsentMap;
  consentOptions?: ConsentToggleOption[];
  licenseManager?: LicenseManager;
  license?: LicenseConfig;
  licenseAttestor?: RemoteLicenseAttestor | RemoteLicenseAttestorOptions;
  licenseAttestorBinding?: RemoteLicenseAttestorBindingOptions;
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
  setLicense(license: LicenseDetails): void;
  validateLicense(context?: Record<string, unknown>): Promise<LicenseStatus>;
  getLicenseStatus(): LicenseStatus;
  getLicenseHistory(): Array<{ status: LicenseStatus; timestamp: string }>;
  getLicenseAttestationHistory(): Array<{ timestamp: string; entry: RemoteLicenseAttestationSummary }>;
  setLicenseAttestor(attestor: RemoteLicenseAttestor | RemoteLicenseAttestorOptions | null, options?: RemoteLicenseAttestorBindingOptions): void;
  requestLicenseAttestation(context?: Record<string, unknown>): Promise<LicenseStatus>;
  onLicenseStatusChange(listener: (status: LicenseStatus) => void): () => void;
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
  removeProfile(id: string): void;
  createAttestor(
    profileId?: string,
    overrides?: LicenseAttestorProfileOverrides
  ): LicenseAttestationProfileBindingResult;
}

export interface RegisterDefaultLicenseAttestationProfilesOptions {
  profileIds?: string[];
  setDefault?: boolean;
  defaultProfileId?: string;
  overrideExisting?: boolean;
}

export const DEFAULT_LICENSE_ATTESTATION_PROFILE_ID: string;
export const DEFAULT_LICENSE_ATTESTATION_PROFILES: LicenseAttestationProfile[];
export function resolveDefaultProfiles(profileIds?: string[]): LicenseAttestationProfile[];
export function registerDefaultLicenseAttestationProfiles(
  registry: LicenseAttestationProfileRegistry,
  options?: RegisterDefaultLicenseAttestationProfilesOptions
): LicenseAttestationProfile[];

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

declare module './src/product/telemetry/storage/RemoteStorageAdapters.js' {
  export function createSignedS3StorageAdapter(options: SignedS3StorageAdapterOptions): RemoteStorageAdapter;
  export function createLogBrokerStorageAdapter(options: LogBrokerStorageAdapterOptions): RemoteStorageAdapter;
}

declare module '../src/product/telemetry/storage/RemoteStorageAdapters.js' {
  export function createSignedS3StorageAdapter(options: SignedS3StorageAdapterOptions): RemoteStorageAdapter;
  export function createLogBrokerStorageAdapter(options: LogBrokerStorageAdapterOptions): RemoteStorageAdapter;
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
    LicenseAttestorProfileOverrides
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
    LicenseAttestorProfileOverrides
  };
}

declare module './src/product/licensing/attestationProfiles/defaultProfiles.js' {
  export {
    DEFAULT_LICENSE_ATTESTATION_PROFILE_ID,
    DEFAULT_LICENSE_ATTESTATION_PROFILES,
    RegisterDefaultLicenseAttestationProfilesOptions,
    registerDefaultLicenseAttestationProfiles,
    resolveDefaultProfiles
  };
}

declare module '../src/product/licensing/attestationProfiles/defaultProfiles.js' {
  export {
    DEFAULT_LICENSE_ATTESTATION_PROFILE_ID,
    DEFAULT_LICENSE_ATTESTATION_PROFILES,
    RegisterDefaultLicenseAttestationProfilesOptions,
    registerDefaultLicenseAttestationProfiles,
    resolveDefaultProfiles
  };
}
