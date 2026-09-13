import type {
  InfraComputeSelection,
  InfraComputeTarget,
  InfraExecutionContext,
  InfraReconcileResult,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { HetznerCloudApi, HetznerHostKeyProbe } from '../../../types/hetznerCompute';
import { toOwnedResources, toPublicOutputs } from './hetznerResults';
import { projectHetznerCompute } from './projectHetznerCompute';
import { resolveHetznerCredentialsAsync } from './resolveHetznerCredentialsAsync';

/** Reconcile owned Cloud resources and return one verified portable SSH target. */
export async function ensureHetznerComputeAsync(
  api: HetznerCloudApi,
  hostKeyProbe: HetznerHostKeyProbe,
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'hetzner'>,
): Promise<
  InfraResult<InfraReconcileResult & { readonly targets: readonly InfraComputeTarget[] }>
> {
  const credentials = await resolveHetznerCredentialsAsync(context, selection);
  if (!credentials.ok) return credentials;
  const desired = projectHetznerCompute(context, selection, credentials.value.sshPublicKey);
  const reconciled = await api.reconcileAsync(credentials.value.token, desired, context.signal);
  if (!reconciled.ok) return reconciled;
  const server = reconciled.value.resources.find(({ resourceId }) => resourceId === 'server');
  if (
    server?.state !== 'ready' ||
    server.publicIpv4 === undefined ||
    server.architecture === undefined
  ) {
    return unavailableServer();
  }
  const fingerprint = await hostKeyProbe.fingerprintAsync(
    server.publicIpv4,
    desired.sshPort,
    context.signal,
  );
  if (!fingerprint.ok) return fingerprint;
  return {
    ok: true,
    value: {
      resources: toOwnedResources(desired.identity, reconciled.value),
      outputs: toPublicOutputs(desired.identity, reconciled.value),
      targets: [
        {
          id: 'server',
          kind: 'ssh-host',
          os: 'linux',
          architecture: server.architecture,
          host: server.publicIpv4,
          port: desired.sshPort,
          user: desired.sshUser,
          credential: credentials.value.sshReference,
          hostKeyFingerprint: fingerprint.value,
        },
      ],
    },
    diagnostics: [],
  };
}

function unavailableServer(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'hetzner-server-unavailable',
        message: 'The Hetzner server is not ready with a public IPv4 address.',
      },
    ],
  };
}
