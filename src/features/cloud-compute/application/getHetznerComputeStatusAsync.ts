import type {
  InfraExecutionContext,
  InfraResourceStatus,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { HetznerCloudApi } from '../../../types/hetznerCompute';
import { getHetznerIdentity } from '../utils/hetznerOwnership';
import { toStatuses } from './hetznerResults';
import { resolveHetznerCredentialsAsync } from './resolveHetznerCredentialsAsync';
import { invalidSelection } from './validateHetznerComputeAsync';

/** Read exact owned Hetzner resource status from a fresh execution context. */
export async function getHetznerComputeStatusAsync(
  api: HetznerCloudApi,
  context: InfraExecutionContext,
): Promise<InfraResult<readonly InfraResourceStatus[]>> {
  const selection = context.desired.deployment.compute;
  if (selection.provider !== 'hetzner') return invalidSelection();
  const credentials = await resolveHetznerCredentialsAsync(context, selection);
  if (!credentials.ok) return credentials;
  const identity = getHetznerIdentity(context);
  const observed = await api.inspectAsync(credentials.value.token, identity, context.signal);
  return observed.ok
    ? { ok: true, value: toStatuses(identity, observed.value), diagnostics: [] }
    : observed;
}
