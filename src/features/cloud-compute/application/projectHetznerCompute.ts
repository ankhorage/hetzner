import { createHash } from 'node:crypto';

import type { InfraComputeSelection, InfraExecutionContext } from '@ankhorage/contracts/infra';

import type { HetznerDesiredCompute, HetznerResourceId } from '../../../types/hetznerCompute';
import { createHetznerOwner, getHetznerIdentity } from '../utils/hetznerOwnership';

/** Project one low-cost, single-node Hetzner compute target without runtime-specific behavior. */
export function projectHetznerCompute(
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'hetzner'>,
  sshPublicKey: string,
): HetznerDesiredCompute {
  const identity = getHetznerIdentity(context);
  const suffix = createHash('sha256')
    .update(`${context.projectId}:${context.environment}`)
    .digest('hex')
    .slice(0, 10);
  const prefix = `ankh-${context.environment}-${suffix}`;
  const base = {
    location: selection.location,
    serverType: selection.serverType ?? 'cx23',
    image: selection.image ?? 'ubuntu-24.04',
    sshUser: selection.ssh?.user ?? 'root',
    sshPort: selection.ssh?.port ?? 22,
    sshPublicKey,
  };
  const resource = (resourceId: HetznerResourceId) => ({
    owner: createHetznerOwner(identity, resourceId),
    name: `${prefix}-${resourceId}`,
    configurationHash: createHash('sha256')
      .update(JSON.stringify({ ...base, resourceId }))
      .digest('hex')
      .slice(0, 32),
  });
  return {
    identity,
    ...base,
    network: resource('network'),
    firewall: resource('firewall'),
    sshKey: resource('ssh-key'),
    server: resource('server'),
  };
}
