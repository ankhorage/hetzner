import type {
  InfraComputeSelection,
  InfraExecutionContext,
  InfraPlanAction,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { HetznerCloudApi, HetznerResourceId } from '../../../types/hetznerCompute';
import { projectHetznerCompute } from './projectHetznerCompute';
import { resolveHetznerCredentialsAsync } from './resolveHetznerCredentialsAsync';

/** Compare exact owned Cloud state with the deterministic single-node projection. */
export async function planHetznerComputeAsync(
  api: HetznerCloudApi,
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'hetzner'>,
): Promise<InfraResult<readonly InfraPlanAction[]>> {
  const credentials = await resolveHetznerCredentialsAsync(context, selection);
  if (!credentials.ok) return credentials;
  const desired = projectHetznerCompute(context, selection, credentials.value.sshPublicKey);
  const observed = await api.inspectAsync(
    credentials.value.token,
    desired.identity,
    context.signal,
  );
  if (!observed.ok) return observed;
  const byId = new Map(observed.value.resources.map((resource) => [resource.resourceId, resource]));
  return {
    ok: true,
    value: [desired.network, desired.firewall, desired.sshKey, desired.server].map((resource) => {
      const current = byId.get(resource.owner.identity.resourceId as HetznerResourceId);
      const operation =
        current === undefined
          ? 'create'
          : current.configurationHash === resource.configurationHash
            ? 'noop'
            : 'update';
      return {
        owner: resource.owner.identity,
        operation,
        impact:
          operation === 'update' && resource.owner.identity.resourceId === 'server'
            ? 'interrupts-service'
            : 'none',
        detail: `${operation} Hetzner ${resource.owner.identity.resourceId}.`,
        dependsOn: resource.owner.dependsOn,
      };
    }),
    diagnostics: [],
  };
}
