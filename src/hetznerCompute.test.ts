import type {
  InfraComputeSelection,
  InfraExecutionContext,
  InfraResult,
} from '@ankhorage/contracts/infra';
import { expect, it } from 'bun:test';

import { createInfraAdapter } from './index';
import type {
  HetznerCloudApi,
  HetznerCloudObservation,
  HetznerDesiredCompute,
  HetznerHostKeyProbe,
  HetznerProjectIdentity,
  HetznerResourceId,
} from './types/hetznerCompute';

it('plans, reconciles, observes and destroys exact owned Hetzner compute', async () => {
  const api = new FakeHetznerCloudApi();
  const adapter = createInfraAdapter({ api, hostKeyProbe: new FakeHostKeyProbe() });
  const context = createContext();
  const selection = getSelection(context);

  expect((await adapter.validateAsync(context, selection)).ok).toBe(true);
  const initial = await adapter.planAsync(context, selection);
  expect(initial.ok && initial.value.every(({ operation }) => operation === 'create')).toBe(true);
  const ensured = await adapter.ensureAsync(context, selection);
  expect(ensured.ok && ensured.value.targets).toEqual([
    {
      id: 'server',
      kind: 'ssh-host',
      os: 'linux',
      architecture: 'amd64',
      host: '203.0.113.7',
      port: 22,
      user: 'root',
      credential: { source: 'control-plane', name: 'HETZNER_SSH' },
      hostKeyFingerprint: 'SHA256:verified-host',
    },
  ]);
  expect(ensured.ok && ensured.value.outputs[0]?.value).toBe('203.0.113.7');
  expect(JSON.stringify(ensured)).not.toContain('private-key-value');
  const converged = await adapter.planAsync(context, selection);
  expect(converged.ok && converged.value.every(({ operation }) => operation === 'noop')).toBe(true);
  expect((await adapter.statusAsync(context)).ok).toBe(true);
  const destroyed = await adapter.destroyAsync(context, destroyRequest());
  expect(destroyed.ok && destroyed.value.resources).toHaveLength(0);
  expect(api.destroyed).toEqual(['server', 'firewall', 'network', 'ssh-key']);
});

it('refuses destroy when the project confirmation does not match', async () => {
  const api = new FakeHetznerCloudApi();
  const adapter = createInfraAdapter({ api, hostKeyProbe: new FakeHostKeyProbe() });
  const result = await adapter.destroyAsync(createContext(), {
    ...destroyRequest(),
    confirmation: { projectId: 'other', environment: 'production' },
  });
  expect(result.ok).toBe(false);
  expect(api.destroyed).toEqual([]);
});

class FakeHetznerCloudApi implements HetznerCloudApi {
  observation: HetznerCloudObservation = { resources: [] };
  destroyed: HetznerResourceId[] = [];

  validateAsync(): Promise<InfraResult<null>> {
    return success(null);
  }

  inspectAsync(): Promise<InfraResult<HetznerCloudObservation>> {
    return success(this.observation);
  }

  reconcileAsync(
    _token: string,
    desired: HetznerDesiredCompute,
  ): Promise<InfraResult<HetznerCloudObservation>> {
    this.observation = {
      resources: [desired.network, desired.firewall, desired.sshKey, desired.server].map(
        (resource, index) => ({
          resourceId: resource.owner.identity.resourceId as HetznerResourceId,
          externalId: String(index + 1),
          configurationHash: resource.configurationHash,
          state: 'ready' as const,
          ...(resource.owner.identity.resourceId === 'server'
            ? { publicIpv4: '203.0.113.7', architecture: 'amd64' as const }
            : {}),
        }),
      ),
    };
    return success(this.observation);
  }

  destroyAsync(
    _token: string,
    _identity: HetznerProjectIdentity,
    resourceIds: readonly HetznerResourceId[],
  ): Promise<InfraResult<HetznerCloudObservation>> {
    this.destroyed.push(...resourceIds);
    this.observation = {
      resources: this.observation.resources.filter(
        ({ resourceId }) => !resourceIds.includes(resourceId),
      ),
    };
    return success(this.observation);
  }
}

class FakeHostKeyProbe implements HetznerHostKeyProbe {
  fingerprintAsync(): Promise<InfraResult<string>> {
    return success('SHA256:verified-host');
  }
}

function createContext(): InfraExecutionContext {
  return {
    projectId: 'sample',
    environment: 'production',
    desired: {
      deployment: {
        compute: {
          provider: 'hetzner',
          location: 'fsn1',
          credentials: { source: 'control-plane', name: 'HCLOUD_TOKEN' },
          ssh: { credentials: { source: 'control-plane', name: 'HETZNER_SSH' } },
        },
        runtime: { provider: 'k3s', topology: { servers: 1, agents: 0 } },
      },
    },
    credentials: {
      resolveAsync: ({ name }) => {
        const value: Readonly<Record<string, string>> =
          name === 'HCLOUD_TOKEN'
            ? { token: 'api-token-value' }
            : {
                publicKey: 'ssh-ed25519 AAAA test',
                privateKey: 'private-key-value',
              };
        return success(value);
      },
    },
    secrets: {
      resolveAsync: () => success('secret-value'),
    },
  };
}

function getSelection(context: InfraExecutionContext): InfraComputeSelection<'hetzner'> {
  const selection = context.desired.deployment.compute;
  if (selection.provider !== 'hetzner') throw new Error('Invalid fixture.');
  return selection;
}

function destroyRequest() {
  return {
    projectId: 'sample',
    environment: 'production' as const,
    confirmation: { projectId: 'sample', environment: 'production' as const },
    persistence: { policy: 'retain' as const },
  };
}

function success<T>(value: T): Promise<InfraResult<T>> {
  return Promise.resolve({ ok: true, value, diagnostics: [] });
}
