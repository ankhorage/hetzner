import type {
  InfraDestroyRequest,
  InfraExecutionContext,
  InfraReconcileResult,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { HetznerCloudApi, HetznerResourceId } from '../../../types/hetznerCompute';
import { getHetznerIdentity } from '../utils/hetznerOwnership';
import { toOwnedResources, toPublicOutputs } from './hetznerResults';
import { resolveHetznerCredentialsAsync } from './resolveHetznerCredentialsAsync';
import { invalidSelection } from './validateHetznerComputeAsync';

/** Delete exact owned compute resources only after project/environment confirmation. */
export async function destroyHetznerComputeAsync(
  api: HetznerCloudApi,
  context: InfraExecutionContext,
  request: InfraDestroyRequest,
): Promise<InfraResult<InfraReconcileResult>> {
  if (!isConfirmed(context, request)) return unconfirmed();
  const selection = context.desired.deployment.compute;
  if (selection.provider !== 'hetzner') return invalidSelection();
  const credentials = await resolveHetznerCredentialsAsync(context, selection);
  if (!credentials.ok) return credentials;
  const identity = getHetznerIdentity(context);
  const removed = await api.destroyAsync(
    credentials.value.token,
    identity,
    ['server', 'firewall', 'network', 'ssh-key'] satisfies readonly HetznerResourceId[],
    context.signal,
  );
  return removed.ok
    ? {
        ok: true,
        value: {
          resources: toOwnedResources(identity, removed.value),
          outputs: toPublicOutputs(identity, removed.value),
        },
        diagnostics: [],
      }
    : removed;
}

function isConfirmed(context: InfraExecutionContext, request: InfraDestroyRequest): boolean {
  return (
    request.projectId === context.projectId &&
    request.environment === context.environment &&
    request.confirmation.projectId === context.projectId &&
    request.confirmation.environment === context.environment
  );
}

function unconfirmed(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'hetzner-destroy-unconfirmed',
        message: 'Hetzner destroy requires exact project and environment confirmation.',
      },
    ],
  };
}
