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

export interface ComplianceVaultTelemetryProviderOptions {
  id?: string;
  metadata?: Record<string, unknown>;
  storageKey?: string;
  maxRecords?: number;
  includeClassifications?: string[];
  storageAdapter?: {
    read?(): TelemetryAuditEntry[];
    write?(records: TelemetryAuditEntry[]): void;
    clear?(): void;
  };
}

export class ComplianceVaultTelemetryProvider {
  constructor(options?: ComplianceVaultTelemetryProviderOptions);
  id: string;
  metadata: Record<string, unknown>;
  getRecords(): TelemetryAuditEntry[];
  clear(): void;
  flush(): void;
}

declare module './src/core/AdaptiveSDK.js' {
  export function createAdaptiveSDK(config?: AdaptiveSDKConfig): AdaptiveSDK;
}

declare module '../src/core/AdaptiveSDK.js' {
  export function createAdaptiveSDK(config?: AdaptiveSDKConfig): AdaptiveSDK;
}
