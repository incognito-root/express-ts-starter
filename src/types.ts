export type FeatureName =
  | "websocket"
  | "uploads"
  | "bullmq"
  | "metrics"
  | "otel"
  | "versioning"
  | "idempotency"
  | "circuitBreaker"
  | "csrf"
  | "audit"
  | "k6"
  | "pm2"
  | "aiInstructions";

export interface FeatureDefinition {
  name: FeatureName;
  label: string;
  description: string;
  /** Files/dirs to include only when this feature is selected */
  includePaths: string[];
  /** Dependencies to add to package.json */
  dependencies?: Record<string, string>;
  /** Dev dependencies to add to package.json */
  devDependencies?: Record<string, string>;
  /** Script keys to remove from package.json when disabled */
  removeScripts?: string[];
  /** Hidden features are not shown in the interactive feature multiselect */
  hidden?: boolean;
}

export interface GeneratorOptions {
  projectName: string;
  projectDir: string;
  features: FeatureName[];
  productionUrl: string;
  dbName: string;
  initGit: boolean;
  installDeps: boolean;
}
