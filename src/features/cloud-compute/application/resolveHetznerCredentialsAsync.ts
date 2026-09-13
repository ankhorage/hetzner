import type {
  InfraComputeSelection,
  InfraControlPlaneCredentialRef,
  InfraExecutionContext,
  InfraResult,
} from '@ankhorage/contracts/infra';

interface HetznerCredentials {
  readonly token: string;
  readonly sshPublicKey: string;
  readonly sshReference: InfraControlPlaneCredentialRef;
}

const DEFAULT_API_CREDENTIAL = { source: 'control-plane', name: 'HCLOUD_TOKEN' } as const;
const DEFAULT_SSH_CREDENTIAL = { source: 'control-plane', name: 'HETZNER_SSH' } as const;

/** Resolve bootstrap credentials transiently and expose only fields needed by the compute boundary. */
export async function resolveHetznerCredentialsAsync(
  context: InfraExecutionContext,
  selection: InfraComputeSelection<'hetzner'>,
): Promise<InfraResult<HetznerCredentials>> {
  const apiReference = selection.credentials ?? DEFAULT_API_CREDENTIAL;
  const sshReference = selection.ssh?.credentials ?? DEFAULT_SSH_CREDENTIAL;
  const [api, ssh] = await Promise.all([
    context.credentials.resolveAsync(apiReference),
    context.credentials.resolveAsync(sshReference),
  ]);
  if (!api.ok) return api;
  if (!ssh.ok) return ssh;
  const { token } = api.value;
  const { publicKey } = ssh.value;
  const { privateKey } = ssh.value;
  if (!isNonEmpty(token) || !isNonEmpty(publicKey) || !isNonEmpty(privateKey)) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'hetzner-credentials-invalid',
          message:
            'Hetzner requires a token plus matching publicKey/privateKey SSH credential fields.',
        },
      ],
    };
  }
  return {
    ok: true,
    value: { token, sshPublicKey: publicKey, sshReference },
    diagnostics: [],
  };
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}
