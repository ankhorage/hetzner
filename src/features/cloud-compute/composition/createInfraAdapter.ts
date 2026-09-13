import type { InfraComputeAdapter } from '@ankhorage/contracts/infra';

import { infraAdapterDescriptor } from '../../../constants/infra';
import type { HetznerAdapterOptions } from '../../../types/hetznerCompute';
import { createFetchHetznerCloudApi } from '../adapters/outbound/createFetchHetznerCloudApi';
import { createNodeHetznerHostKeyProbe } from '../adapters/outbound/createNodeHetznerHostKeyProbe';
import { destroyHetznerComputeAsync } from '../application/destroyHetznerComputeAsync';
import { ensureHetznerComputeAsync } from '../application/ensureHetznerComputeAsync';
import { getHetznerComputeStatusAsync } from '../application/getHetznerComputeStatusAsync';
import { planHetznerComputeAsync } from '../application/planHetznerComputeAsync';
import { validateHetznerComputeAsync } from '../application/validateHetznerComputeAsync';

/***
 * Create the canonical Hetzner Cloud compute adapter.
 *
 * The default composition uses the authenticated Cloud REST API and a shell-free SSH host-key
 * probe. Provider API and SSH credentials remain transient execution inputs.
 *
 * @readme
 */
export function createInfraAdapter(
  options: HetznerAdapterOptions = {},
): InfraComputeAdapter<'hetzner'> {
  const api = options.api ?? createFetchHetznerCloudApi();
  const hostKeyProbe = options.hostKeyProbe ?? createNodeHetznerHostKeyProbe();
  return {
    descriptor: infraAdapterDescriptor,
    validateAsync: (context, selection) => validateHetznerComputeAsync(api, context, selection),
    planAsync: (context, selection) => planHetznerComputeAsync(api, context, selection),
    ensureAsync: (context, selection) =>
      ensureHetznerComputeAsync(api, hostKeyProbe, context, selection),
    statusAsync: (context) => getHetznerComputeStatusAsync(api, context),
    destroyAsync: (context, request) => destroyHetznerComputeAsync(api, context, request),
  };
}
