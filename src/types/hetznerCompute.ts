import type {
  InfraComputeSelection,
  InfraExecutionContext,
  InfraOwnedResource,
  InfraResult,
} from '@ankhorage/contracts/infra';

export type HetznerResourceId = 'network' | 'firewall' | 'ssh-key' | 'server';

export interface HetznerProjectIdentity {
  readonly projectId: string;
  readonly environment: InfraExecutionContext['environment'];
}

interface HetznerDesiredResource {
  readonly owner: InfraOwnedResource;
  readonly name: string;
  readonly configurationHash: string;
}

export interface HetznerDesiredCompute {
  readonly identity: HetznerProjectIdentity;
  readonly location: string;
  readonly serverType: string;
  readonly image: string;
  readonly sshUser: string;
  readonly sshPort: number;
  readonly sshPublicKey: string;
  readonly network: HetznerDesiredResource;
  readonly firewall: HetznerDesiredResource;
  readonly sshKey: HetznerDesiredResource;
  readonly server: HetznerDesiredResource;
}

export interface HetznerResourceObservation {
  readonly resourceId: HetznerResourceId;
  readonly externalId: string;
  readonly configurationHash?: string;
  readonly state: 'pending' | 'ready' | 'stopped' | 'degraded' | 'failed' | 'unknown';
  readonly publicIpv4?: string;
  readonly architecture?: 'amd64' | 'arm64';
}

export interface HetznerCloudObservation {
  readonly resources: readonly HetznerResourceObservation[];
}

export interface HetznerCloudApi {
  validateAsync(
    token: string,
    selection: InfraComputeSelection<'hetzner'>,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  inspectAsync(
    token: string,
    identity: HetznerProjectIdentity,
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerCloudObservation>>;
  reconcileAsync(
    token: string,
    desired: HetznerDesiredCompute,
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerCloudObservation>>;
  destroyAsync(
    token: string,
    identity: HetznerProjectIdentity,
    resourceIds: readonly HetznerResourceId[],
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerCloudObservation>>;
}

export interface HetznerHostKeyProbe {
  fingerprintAsync(host: string, port: number, signal?: AbortSignal): Promise<InfraResult<string>>;
}

export interface HetznerAdapterOptions {
  readonly api?: HetznerCloudApi;
  readonly hostKeyProbe?: HetznerHostKeyProbe;
}

export interface HetznerFetchApiOptions {
  readonly endpoint?: string;
  readonly fetch?: typeof fetch;
  readonly pollIntervalMs?: number;
}
