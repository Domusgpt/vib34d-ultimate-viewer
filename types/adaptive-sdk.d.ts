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

export interface AdaptiveSDKConfig {
  sensory?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  design?: Record<string, unknown>;
  telemetry?: Record<string, unknown>;
  marketplaceHooks?: Record<string, unknown>;
  layoutStrategies?: any[];
  layoutAnnotations?: any[];
  telemetryProviders?: any[];
  replaceDefaultProviders?: boolean;
  sensorSchemas?: Array<{ type: string; schema: SensorSchema }> | Record<string, SensorSchema>;
  sensorAdapters?: Array<{ type: string; instance: SensorAdapter; autoConnect?: boolean }>;
  telemetryConsent?: TelemetryConsentMap;
}

export interface AdaptiveSDK {
  engine: any;
  sensoryBridge: any;
  layoutSynthesizer: any;
  telemetry: any;
  registerLayoutStrategy(strategy: any): any;
  registerLayoutAnnotation(annotation: any): any;
  registerTelemetryProvider(provider: any): any;
  registerSensorSchema(type: string, schema: SensorSchema): any;
  registerSensorAdapter(type: string, adapter: SensorAdapter, options?: { autoConnect?: boolean }): any;
  connectSensorAdapter(type: string): Promise<void>;
  disconnectSensorAdapter(type: string): Promise<void>;
  testSensorAdapter(type: string): Promise<boolean | void>;
  updateTelemetryConsent(consent: TelemetryConsentMap, metadata?: Record<string, unknown>): void;
  getTelemetryConsent(): TelemetryConsentMap;
  getTelemetryAuditTrail(): TelemetryAuditEntry[];
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

export interface SignedS3StorageAdapterOptions {
  signingEndpoint: string;
  signingMethod?: string;
  signingHeaders?: Record<string, string>;
  signingPayload?: Record<string, unknown>;
  uploadMethod?: string;
  uploadHeaders?: Record<string, string>;
  fetchImplementation?: typeof fetch;
  serialize?: (records: TelemetryAuditEntry[]) => string | object;
  onUploadComplete?: (info: { key?: string; location?: string; recordCount: number }) => void;
  onError?: (error: Error) => void;
  deleteEndpoint?: string;
  deleteMethod?: string;
}

export interface LogBrokerStorageAdapterOptions {
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  fetchImplementation?: typeof fetch;
  serialize?: (records: TelemetryAuditEntry[]) => string | object;
  onError?: (error: Error) => void;
}

export interface RemoteStorageAdapter {
  write(records: TelemetryAuditEntry[]): Promise<void>;
  clear(): Promise<void | undefined>;
  read(): Promise<TelemetryAuditEntry[]>;
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
