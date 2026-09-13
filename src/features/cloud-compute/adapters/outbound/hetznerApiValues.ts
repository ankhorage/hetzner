import type { InfraResult } from '@ankhorage/contracts/infra';

import type {
  HetznerCloudObservation,
  HetznerDesiredCompute,
  HetznerResourceId,
  HetznerResourceObservation,
} from '../../../../types/hetznerCompute';
import { HETZNER_LABELS } from '../../utils/hetznerOwnership';

export type HetznerListKey = 'networks' | 'firewalls' | 'ssh_keys' | 'servers';

export function createHetznerResourceBody(
  resourceId: HetznerResourceId,
  desired: HetznerDesiredCompute,
  labels: Readonly<Record<string, string>>,
  dependencies?: Readonly<Record<'network' | 'firewall' | 'sshKey', HetznerResourceObservation>>,
): Readonly<Record<string, unknown>> | undefined {
  switch (resourceId) {
    case 'network':
      return {
        name: desired.network.name,
        ip_range: '10.42.0.0/16',
        subnets: [
          {
            type: 'cloud',
            network_zone: getNetworkZone(desired.location),
            ip_range: '10.42.0.0/24',
          },
        ],
        labels,
      };
    case 'firewall':
      return {
        name: desired.firewall.name,
        labels,
        rules: [desired.sshPort, 80, 443, 6443].map((port) => ({
          direction: 'in',
          protocol: 'tcp',
          port: String(port),
          source_ips: ['0.0.0.0/0', '::/0'],
        })),
      };
    case 'ssh-key':
      return { name: desired.sshKey.name, public_key: desired.sshPublicKey, labels };
    case 'server':
      return dependencies === undefined
        ? undefined
        : {
            name: desired.server.name,
            location: desired.location,
            server_type: desired.serverType,
            image: desired.image,
            networks: [Number(dependencies.network.externalId)],
            firewalls: [{ firewall: Number(dependencies.firewall.externalId) }],
            ssh_keys: [Number(dependencies.sshKey.externalId)],
            public_net: { enable_ipv4: true, enable_ipv6: false },
            labels,
          };
  }
}

export function parseHetznerResource(
  value: unknown,
  resourceId: HetznerResourceId,
): HetznerResourceObservation | undefined {
  if (!isRecord(value) || (typeof value.id !== 'number' && typeof value.id !== 'string'))
    return undefined;
  const labels = isRecord(value.labels) ? value.labels : {};
  const labeledResourceId = labels[HETZNER_LABELS.resourceId];
  if (labeledResourceId !== undefined && labeledResourceId !== resourceId) return undefined;
  const hash = labels[HETZNER_LABELS.configurationHash];
  const publicIpv4 = readServerIpv4(value);
  const architecture = readServerArchitecture(value);
  return {
    resourceId,
    externalId: String(value.id),
    ...(typeof hash === 'string' ? { configurationHash: hash } : {}),
    state: mapState(typeof value.status === 'string' ? value.status : 'running'),
    ...(publicIpv4 === undefined ? {} : { publicIpv4 }),
    ...(architecture === undefined ? {} : { architecture }),
  };
}

export function hasHetznerDrift(
  observed: HetznerCloudObservation,
  desired: HetznerDesiredCompute,
): boolean {
  const hashes: Readonly<Record<HetznerResourceId, string>> = {
    network: desired.network.configurationHash,
    firewall: desired.firewall.configurationHash,
    'ssh-key': desired.sshKey.configurationHash,
    server: desired.server.configurationHash,
  };
  return observed.resources.some(
    (resource) => resource.configurationHash !== hashes[resource.resourceId],
  );
}

export function readHetznerList(
  value: unknown,
  key: HetznerListKey,
): readonly unknown[] | undefined {
  if (!isRecord(value)) return undefined;
  const candidate =
    key === 'networks'
      ? value.networks
      : key === 'firewalls'
        ? value.firewalls
        : key === 'ssh_keys'
          ? value.ssh_keys
          : value.servers;
  return Array.isArray(candidate) ? candidate : undefined;
}

export function readCreatedHetznerResource(
  value: unknown,
  resourceId: HetznerResourceId,
): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value)) return undefined;
  const candidate =
    resourceId === 'network'
      ? value.network
      : resourceId === 'firewall'
        ? value.firewall
        : resourceId === 'ssh-key'
          ? value.ssh_key
          : value.server;
  return isRecord(candidate) ? candidate : undefined;
}

export function readActionId(value: unknown): number | undefined {
  return isRecord(value) && isRecord(value.action) && typeof value.action.id === 'number'
    ? value.action.id
    : undefined;
}

export function readActionStatus(value: unknown): string | undefined {
  return isRecord(value) && isRecord(value.action) && typeof value.action.status === 'string'
    ? value.action.status
    : undefined;
}

export function hasNamedHetznerResource(
  value: unknown,
  key: 'locations' | 'server_types' | 'images',
): boolean {
  if (!isRecord(value)) return false;
  const list =
    key === 'locations'
      ? value.locations
      : key === 'server_types'
        ? value.server_types
        : value.images;
  return Array.isArray(list) && list.length > 0;
}

export function apiSuccess<T>(value: T): InfraResult<T> {
  return { ok: true, value, diagnostics: [] };
}

export function apiFailure(code: string): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [{ severity: 'error', code, message: 'The Hetzner Cloud operation failed.' }],
  };
}

function readServerIpv4(value: Readonly<Record<string, unknown>>): string | undefined {
  const publicNetwork = value.public_net;
  if (!isRecord(publicNetwork) || !isRecord(publicNetwork.ipv4)) return undefined;
  return typeof publicNetwork.ipv4.ip === 'string' ? publicNetwork.ipv4.ip : undefined;
}

function readServerArchitecture(
  value: Readonly<Record<string, unknown>>,
): 'amd64' | 'arm64' | undefined {
  const serverType = value.server_type;
  if (!isRecord(serverType) || typeof serverType.architecture !== 'string') return undefined;
  if (['x86', 'x64', 'amd64'].includes(serverType.architecture)) return 'amd64';
  return ['arm', 'arm64'].includes(serverType.architecture) ? 'arm64' : undefined;
}

function mapState(status: string): HetznerResourceObservation['state'] {
  if (status === 'running') return 'ready';
  if (status === 'off') return 'stopped';
  if (status === 'initializing' || status === 'starting') return 'pending';
  return 'degraded';
}

function getNetworkZone(location: string): string {
  if (location === 'ash') return 'us-east';
  if (location === 'hil') return 'us-west';
  if (location === 'sin') return 'ap-southeast';
  return 'eu-central';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
