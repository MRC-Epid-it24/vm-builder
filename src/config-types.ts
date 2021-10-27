export interface VirtualBoxConfig {
  homeDirectoryOverride?: string;
  command: string;
  vmname: string;
  ip4address: string;
}

export interface DownloadableResource {
  downloadUrl: string;
  sha256: string;
}

export interface DeploymentConfig {
  ansiblePlaybookCommand: string;
  directory: string;
}

export interface ApiServerConfig {
  dataExportServiceDebianPackagePath: string;
  port: string;
  v1debianPackagePath: string;
  v2jarPath: string;
  playSecret: string;
}

export interface AdminConfig {
  port: string;
  address: string;
}

export interface FrontendConfig {
  port: string;
  debianPackagePath: string;
  address: string;
}

export interface Configuration {
  buildIdOverride?: string;
  skipIntegrityChecks: boolean;
  homeDirectoryOverride?: string;
  delayTime: number;

  virtualBox: VirtualBoxConfig;
  deployment: DeploymentConfig;
  apiServer: ApiServerConfig;
  admin: AdminConfig;
  frontend: FrontendConfig;

  ova: DownloadableResource;
  systemDatabase: DownloadableResource;
  foodDatabase: DownloadableResource;
  imageDatabase: DownloadableResource;
}
export interface OneInputFunction {
  (payload: Payload): Promise<string | void>;
}

export type ArrayofFunctions = Array<{
  fn: OneInputFunction;
  payload: Payload;
}>;

export interface Payload {
  homeDirectoryPath: string;
  buildId: string;
  exampleInstanceDirectoryPath: string;
  buildInstanceDirectoryPath: string;
}
