import type {
  InfraComputeSnapshot,
  InfraControlPlaneCredentialRef,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type {
  HetznerCloudObservation,
  HetznerDesiredCompute,
  HetznerHostKeyProbe,
} from '../../../types/hetznerCompute';
import { toOwnedResources, toPublicOutputs } from './hetznerResults';

/*** Convert observed owned Cloud resources into a portable read-only compute snapshot. */
export async function createHetznerComputeSnapshotAsync(
  hostKeyProbe: HetznerHostKeyProbe,
  desired: HetznerDesiredCompute,
  sshReference: InfraControlPlaneCredentialRef,
  observation: HetznerCloudObservation,
  signal?: AbortSignal,
): Promise<InfraResult<InfraComputeSnapshot>> {
  const server = observation.resources.find(({ resourceId }) => resourceId === 'server');
  const base = {
    resources: toOwnedResources(desired.identity, observation),
    outputs: toPublicOutputs(desired.identity, observation),
  };
  if (
    server?.state !== 'ready' ||
    server.publicIpv4 === undefined ||
    server.architecture === undefined
  ) {
    return { ok: true, value: { ...base, targets: [] }, diagnostics: [] };
  }
  const fingerprint = await hostKeyProbe.fingerprintAsync(
    server.publicIpv4,
    desired.sshPort,
    signal,
  );
  if (!fingerprint.ok) return fingerprint;
  return {
    ok: true,
    value: {
      ...base,
      targets: [
        {
          id: 'server',
          kind: 'ssh-host',
          os: 'linux',
          architecture: server.architecture,
          host: server.publicIpv4,
          port: desired.sshPort,
          user: desired.sshUser,
          credential: sshReference,
          hostKeyFingerprint: fingerprint.value,
        },
      ],
    },
    diagnostics: [],
  };
}
