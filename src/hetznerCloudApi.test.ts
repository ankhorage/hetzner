import { expect, it } from 'bun:test';

import { projectHetznerCompute } from './features/cloud-compute/application/projectHetznerCompute';
import { createFetchHetznerCloudApi } from './index';

it('reconciles exact labeled Cloud resources through authenticated REST requests', async () => {
  const remote = new FakeCloudFetch();
  const api = createFetchHetznerCloudApi({
    endpoint: 'https://api.test/v1',
    fetch: remote.fetch,
  });
  const desired = projectHetznerCompute(
    createContext(),
    { provider: 'hetzner', location: 'fsn1' },
    'ssh-ed25519 AAAA test',
  );

  expect(
    (await api.validateAsync('secret-token', { provider: 'hetzner', location: 'fsn1' })).ok,
  ).toBe(true);
  const result = await api.reconcileAsync('secret-token', desired);

  expect(result.ok && result.value.resources).toHaveLength(4);
  expect(remote.requests.every(({ init }) => init?.headers !== undefined)).toBe(true);
  expect(remote.requests.some(({ url }) => url.includes('label_selector='))).toBe(true);
  const serverRequest = remote.requests.find(
    ({ url, init }) => url.endsWith('/servers') && init?.method === 'POST',
  );
  const serverBody = parseBody(serverRequest?.init?.body);
  expect(serverBody.networks).toEqual([1]);
  expect(serverBody.firewalls).toEqual([{ firewall: 2 }]);
  expect(serverBody.ssh_keys).toEqual([3]);
  expect(JSON.stringify(result)).not.toContain('secret-token');

  const changed = projectHetznerCompute(
    createContext(),
    { provider: 'hetzner', location: 'fsn1', serverType: 'cx33' },
    'ssh-ed25519 AAAA test',
  );
  expect((await api.reconcileAsync('secret-token', changed)).ok).toBe(false);
  expect(remote.requests.some(({ init }) => init?.method === 'DELETE')).toBe(false);
});

it('sanitizes provider response failures', async () => {
  const api = createFetchHetznerCloudApi({
    fetch: (() =>
      Promise.resolve(
        Response.json({ error: { message: 'secret-token leaked' } }, { status: 401 }),
      )) as unknown as typeof fetch,
  });
  const result = await api.inspectAsync('secret-token', {
    projectId: 'sample',
    environment: 'production',
  });
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain('secret-token');
});

class FakeCloudFetch {
  readonly requests: { readonly url: string; readonly init?: RequestInit }[] = [];
  readonly resources = new Map([
    ['networks', [] as unknown[]],
    ['firewalls', [] as unknown[]],
    ['ssh_keys', [] as unknown[]],
    ['servers', [] as unknown[]],
  ]);
  readonly fetch = this.fetchAsync.bind(this) as unknown as typeof fetch;

  private fetchAsync(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = input instanceof Request ? input.url : input.toString();
    this.requests.push({ url, ...(init === undefined ? {} : { init }) });
    const validation = validationResponse(url);
    if (validation !== undefined) return Promise.resolve(Response.json(validation));
    const key = new URL(url).pathname.split('/').at(-1);
    if (init?.method === 'POST' && key !== undefined) return this.createAsync(key, init.body);
    const listKey = [...this.resources.keys()].find((candidate) => url.includes(`/${candidate}?`));
    if (listKey === undefined) return Promise.resolve(Response.json({}));
    const values = this.resources.get(listKey);
    return Promise.resolve(Response.json(listResponse(listKey, values ?? [])));
  }

  private createAsync(key: string, body: RequestInit['body']): Promise<Response> {
    const values = this.resources.get(key);
    if (values === undefined) return Promise.resolve(Response.json({}, { status: 404 }));
    const parsed = parseBody(body);
    const value = {
      id: [...this.resources.values()].flat().length + 1,
      labels: parsed.labels,
      status: 'running',
      ...(key === 'servers'
        ? {
            public_net: { ipv4: { ip: '203.0.113.7' } },
            server_type: { architecture: 'x86' },
          }
        : {}),
    };
    values.push(value);
    return Promise.resolve(Response.json(createResponse(key, value), { status: 201 }));
  }
}

function validationResponse(url: string): Record<string, unknown> | undefined {
  if (url.includes('/locations?')) return { locations: [{ name: 'fsn1' }] };
  if (url.includes('/server_types?')) return { server_types: [{ name: 'cx23' }] };
  if (url.includes('/images?')) return { images: [{ name: 'ubuntu-24.04' }] };
  return undefined;
}

function listResponse(key: string, values: readonly unknown[]): Record<string, unknown> {
  if (key === 'networks') return { networks: values };
  if (key === 'firewalls') return { firewalls: values };
  if (key === 'ssh_keys') return { ssh_keys: values };
  return { servers: values };
}

function createResponse(key: string, value: unknown): Record<string, unknown> {
  if (key === 'networks') return { network: value };
  if (key === 'firewalls') return { firewall: value };
  if (key === 'ssh_keys') return { ssh_key: value };
  return { server: value };
}

function parseBody(body: RequestInit['body']): Record<string, unknown> {
  if (typeof body !== 'string') throw new Error('Expected JSON request body.');
  return JSON.parse(body) as Record<string, unknown>;
}

function createContext() {
  return {
    projectId: 'sample',
    environment: 'production' as const,
    desired: {
      deployment: {
        compute: { provider: 'hetzner' as const, location: 'fsn1' },
        runtime: { provider: 'k3s' as const },
      },
    },
    credentials: { resolveAsync: () => Promise.reject(new Error('unused')) },
    secrets: { resolveAsync: () => Promise.reject(new Error('unused')) },
  };
}
