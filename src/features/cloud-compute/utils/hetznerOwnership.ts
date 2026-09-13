import { createHash } from 'node:crypto';

import type { InfraExecutionContext, InfraOwnedResource } from '@ankhorage/contracts/infra';

import type { HetznerProjectIdentity, HetznerResourceId } from '../../../types/hetznerCompute';

export const HETZNER_LABELS = {
  project: 'ankhorage.com/project',
  environment: 'ankhorage.com/environment',
  adapter: 'ankhorage.com/adapter',
  resourceId: 'ankhorage.com/resource-id',
  configurationHash: 'ankhorage.com/configuration-hash',
} as const;

export function createHetznerOwner(
  identity: HetznerProjectIdentity,
  resourceId: HetznerResourceId,
): InfraOwnedResource {
  const ownIdentity = { ...identity, adapter: 'hetzner' as const, resourceId };
  return {
    identity: ownIdentity,
    persistent: false,
    retention: 'delete-on-destroy',
    dependsOn:
      resourceId === 'server'
        ? (['network', 'firewall', 'ssh-key'] as const).map((dependency) => ({
            ...identity,
            adapter: 'hetzner' as const,
            resourceId: dependency,
          }))
        : [],
  };
}

export function getHetznerLabels(
  identity: HetznerProjectIdentity,
  resourceId?: HetznerResourceId,
  configurationHash?: string,
): Readonly<Record<string, string>> {
  return {
    [HETZNER_LABELS.project]: createHash('sha256')
      .update(identity.projectId)
      .digest('hex')
      .slice(0, 32),
    [HETZNER_LABELS.environment]: identity.environment,
    [HETZNER_LABELS.adapter]: 'hetzner',
    ...(resourceId === undefined ? {} : { [HETZNER_LABELS.resourceId]: resourceId }),
    ...(configurationHash === undefined
      ? {}
      : { [HETZNER_LABELS.configurationHash]: configurationHash }),
  };
}

export function getHetznerIdentity(context: InfraExecutionContext): HetznerProjectIdentity {
  return { projectId: context.projectId, environment: context.environment };
}
