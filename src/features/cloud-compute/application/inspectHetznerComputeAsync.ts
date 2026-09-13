import type {
  InfraComputeSelection,
  InfraComputeSnapshot,
  InfraExecutionContext,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { HetznerCloudApi, HetznerHostKeyProbe } from '../../../types/hetznerCompute';
import { createHetznerComputeSnapshotAsync } from './createHetznerComputeSnapshotAsync';
import { projectHetznerCompute } from './projectHetznerCompute';
import { resolveHetznerCredentialsAsync } from './resolveHetznerCredentialsAsync';

/*** Inspect exact owned Hetzner resources without creating, updating or deleting them. */
export async function inspectHetznerComputeAsync(
  api: HetznerCloudApi,
  hostKeyProbe: HetznerHostKeyProbe,
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'hetzner'>,
): Promise<InfraResult<InfraComputeSnapshot>> {
  const credentials = await resolveHetznerCredentialsAsync(context, selection);
  if (!credentials.ok) return credentials;
  const desired = projectHetznerCompute(context, selection, credentials.value.sshPublicKey);
  const observed = await api.inspectAsync(
    credentials.value.token,
    desired.identity,
    context.signal,
  );
  if (!observed.ok) return observed;
  return createHetznerComputeSnapshotAsync(
    hostKeyProbe,
    desired,
    credentials.value.sshReference,
    observed.value,
    context.signal,
  );
}
