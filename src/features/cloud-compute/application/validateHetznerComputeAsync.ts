import type {
  InfraComputeSelection,
  InfraExecutionContext,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { HetznerCloudApi } from '../../../types/hetznerCompute';
import { resolveHetznerCredentialsAsync } from './resolveHetznerCredentialsAsync';

/** Validate selection and control-plane access without creating cloud resources. */
export async function validateHetznerComputeAsync(
  api: HetznerCloudApi,
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'hetzner'>,
): Promise<InfraResult<null>> {
  if (context.desired.deployment.compute.provider !== 'hetzner') return invalidSelection();
  const credentials = await resolveHetznerCredentialsAsync(context, selection);
  if (!credentials.ok) return credentials;
  return api.validateAsync(credentials.value.token, selection, context.signal);
}

export function invalidSelection(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'hetzner-selection-invalid',
        message: 'Hetzner compute requires the canonical Hetzner selection.',
      },
    ],
  };
}
