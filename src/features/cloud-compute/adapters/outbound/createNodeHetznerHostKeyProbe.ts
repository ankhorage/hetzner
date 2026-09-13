import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

import type { InfraResult } from '@ankhorage/contracts/infra';

import type { HetznerHostKeyProbe } from '../../../../types/hetznerCompute';

/** Create a shell-free SSH host-key probe for freshly provisioned public addresses. */
export function createNodeHetznerHostKeyProbe(): HetznerHostKeyProbe {
  return { fingerprintAsync };
}

async function fingerprintAsync(
  host: string,
  port: number,
  signal?: AbortSignal,
): Promise<InfraResult<string>> {
  const deadline = Date.now() + 120_000;
  while (Date.now() <= deadline) {
    if (signal?.aborted === true) return failure('hetzner-host-key-aborted');
    const scanned = await scanAsync(host, port, signal).catch(() => undefined);
    const fingerprint = scanned === undefined ? undefined : parseFingerprint(scanned);
    if (fingerprint !== undefined) {
      return { ok: true, value: fingerprint, diagnostics: [] };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return failure('hetzner-host-key-timeout');
}

function scanAsync(host: string, port: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ssh-keyscan',
      ['-T', '5', '-p', String(port), '-t', 'ed25519', '--', host],
      {
        shell: false,
        stdio: ['ignore', 'pipe', 'ignore'],
        ...(signal === undefined ? {} : { signal }),
      },
    );
    const output: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(output).toString('utf8'))
        : reject(new Error('scan failed')),
    );
  });
}

function parseFingerprint(output: string): string | undefined {
  for (const line of output.split('\n')) {
    const fields = line.trim().split(/\s+/u);
    if (fields[1] !== 'ssh-ed25519' || fields[2] === undefined) continue;
    try {
      const digest = createHash('sha256').update(Buffer.from(fields[2], 'base64')).digest('base64');
      return `SHA256:${digest.replace(/=+$/u, '')}`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function failure(code: string): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code,
        message: 'The provisioned Hetzner SSH host key could not be verified.',
      },
    ],
  };
}
