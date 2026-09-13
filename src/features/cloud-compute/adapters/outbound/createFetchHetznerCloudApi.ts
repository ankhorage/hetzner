import type { InfraComputeSelection, InfraResult } from '@ankhorage/contracts/infra';

import type {
  HetznerCloudApi,
  HetznerCloudObservation,
  HetznerDesiredCompute,
  HetznerFetchApiOptions,
  HetznerProjectIdentity,
  HetznerResourceId,
  HetznerResourceObservation,
} from '../../../../types/hetznerCompute';
import { getHetznerLabels } from '../../utils/hetznerOwnership';
import {
  apiFailure,
  apiSuccess,
  createHetznerResourceBody,
  hasHetznerDrift,
  hasNamedHetznerResource,
  parseHetznerResource,
  readActionId,
  readActionStatus,
  readCreatedHetznerResource,
  readHetznerList,
} from './hetznerApiValues';

const HETZNER_RESOURCE_LISTS = [
  ['networks', 'network'],
  ['firewalls', 'firewall'],
  ['ssh_keys', 'ssh-key'],
  ['servers', 'server'],
] as const;

/** Create the concrete authenticated Hetzner Cloud REST adapter. */
export function createFetchHetznerCloudApi(options: HetznerFetchApiOptions = {}): HetznerCloudApi {
  const client = new Client(
    options.endpoint ?? 'https://api.hetzner.cloud/v1',
    options.fetch ?? fetch,
    options.pollIntervalMs ?? 500,
  );
  return {
    validateAsync: (token, selection, signal) => client.validateAsync(token, selection, signal),
    inspectAsync: (token, identity, signal) => client.inspectAsync(token, identity, signal),
    reconcileAsync: (token, desired, signal) => client.reconcileAsync(token, desired, signal),
    destroyAsync: (token, identity, resourceIds, signal) =>
      client.destroyAsync(token, identity, resourceIds, signal),
  };
}

class Client implements HetznerCloudApi {
  constructor(
    private readonly endpoint: string,
    private readonly fetcher: typeof fetch,
    private readonly pollIntervalMs: number,
  ) {}

  async validateAsync(
    token: string,
    selection: InfraComputeSelection<'hetzner'>,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>> {
    const location = await this.requestAsync(
      token,
      'GET',
      `/locations?name=${encodeURIComponent(selection.location)}`,
      undefined,
      signal,
    );
    if (!location.ok || !hasNamedHetznerResource(location.value, 'locations')) {
      return apiFailure('hetzner-location-invalid');
    }
    const serverType = await this.requestAsync(
      token,
      'GET',
      `/server_types?name=${encodeURIComponent(selection.serverType ?? 'cx23')}`,
      undefined,
      signal,
    );
    if (!serverType.ok || !hasNamedHetznerResource(serverType.value, 'server_types')) {
      return apiFailure('hetzner-server-type-invalid');
    }
    const image = await this.requestAsync(
      token,
      'GET',
      `/images?name=${encodeURIComponent(selection.image ?? 'ubuntu-24.04')}&type=system`,
      undefined,
      signal,
    );
    return image.ok && hasNamedHetznerResource(image.value, 'images')
      ? apiSuccess(null)
      : apiFailure('hetzner-image-invalid');
  }

  async inspectAsync(
    token: string,
    identity: HetznerProjectIdentity,
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerCloudObservation>> {
    const selector = encodeURIComponent(
      Object.entries(getHetznerLabels(identity))
        .map(([key, value]) => `${key}=${value}`)
        .join(','),
    );
    const requests = await this.listOwnedAsync(token, selector, signal);
    const failed = requests.find(({ result }) => !result.ok);
    if (failed !== undefined) return apiFailure('hetzner-api-request-failed');
    const resources: HetznerResourceObservation[] = [];
    const kinds = HETZNER_RESOURCE_LISTS.map(([, kind]) => kind);
    for (const { key, kind, result } of requests) {
      if (!result.ok) return result;
      const list = readHetznerList(result.value, key);
      if (list === undefined) return apiFailure('hetzner-api-response-invalid');
      for (const value of list) {
        const parsed = parseHetznerResource(value, kind);
        if (parsed === undefined) return apiFailure('hetzner-api-response-invalid');
        resources.push(parsed);
      }
    }
    for (const kind of kinds) {
      if (resources.filter(({ resourceId }) => resourceId === kind).length > 1) {
        return apiFailure('hetzner-ownership-collision');
      }
    }
    return apiSuccess({ resources });
  }

  private listOwnedAsync(token: string, selector: string, signal?: AbortSignal) {
    return Promise.all(
      HETZNER_RESOURCE_LISTS.map(async ([key, kind]) => ({
        key,
        kind,
        result: await this.requestAsync(
          token,
          'GET',
          `/${key}?label_selector=${selector}&per_page=50`,
          undefined,
          signal,
        ),
      })),
    );
  }

  async reconcileAsync(
    token: string,
    desired: HetznerDesiredCompute,
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerCloudObservation>> {
    const observed = await this.inspectAsync(token, desired.identity, signal);
    if (!observed.ok) return observed;
    if (hasHetznerDrift(observed.value, desired)) {
      return apiFailure('hetzner-replacement-requires-destroy');
    }
    const byId = new Map(
      observed.value.resources.map((resource) => [resource.resourceId, resource]),
    );
    let network = byId.get('network');
    if (network === undefined) {
      const created = await this.createAsync(token, 'network', desired, undefined, signal);
      if (!created.ok) return created;
      network = created.value;
    }
    let firewall = byId.get('firewall');
    if (firewall === undefined) {
      const created = await this.createAsync(token, 'firewall', desired, undefined, signal);
      if (!created.ok) return created;
      firewall = created.value;
    }
    let sshKey = byId.get('ssh-key');
    if (sshKey === undefined) {
      const created = await this.createAsync(token, 'ssh-key', desired, undefined, signal);
      if (!created.ok) return created;
      sshKey = created.value;
    }
    if (byId.get('server') === undefined) {
      const created = await this.createAsync(
        token,
        'server',
        desired,
        { network, firewall, sshKey },
        signal,
      );
      if (!created.ok) return created;
    }
    return this.inspectAsync(token, desired.identity, signal);
  }

  async destroyAsync(
    token: string,
    identity: HetznerProjectIdentity,
    resourceIds: readonly HetznerResourceId[],
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerCloudObservation>> {
    const observed = await this.inspectAsync(token, identity, signal);
    if (!observed.ok) return observed;
    const byId = new Map(
      observed.value.resources.map((resource) => [resource.resourceId, resource]),
    );
    for (const resourceId of resourceIds) {
      const resource = byId.get(resourceId);
      if (resource === undefined) continue;
      const endpoint = resourceId === 'ssh-key' ? 'ssh_keys' : `${resourceId}s`;
      const removed = await this.requestAsync(
        token,
        'DELETE',
        `/${endpoint}/${encodeURIComponent(resource.externalId)}`,
        undefined,
        signal,
      );
      if (!removed.ok) return removed;
      const actionId = readActionId(removed.value);
      if (actionId !== undefined) {
        const waited = await this.waitForActionAsync(token, actionId, signal);
        if (!waited.ok) return waited;
      }
    }
    return this.inspectAsync(token, identity, signal);
  }

  private async createAsync(
    token: string,
    resourceId: HetznerResourceId,
    desired: HetznerDesiredCompute,
    dependencies?: Readonly<Record<'network' | 'firewall' | 'sshKey', HetznerResourceObservation>>,
    signal?: AbortSignal,
  ): Promise<InfraResult<HetznerResourceObservation>> {
    const resource = desired[resourceId === 'ssh-key' ? 'sshKey' : resourceId];
    const labels = getHetznerLabels(desired.identity, resourceId, resource.configurationHash);
    const body = createHetznerResourceBody(resourceId, desired, labels, dependencies);
    if (body === undefined) return apiFailure('hetzner-dependency-missing');
    const endpoint = resourceId === 'ssh-key' ? 'ssh_keys' : `${resourceId}s`;
    const response = await this.requestAsync(token, 'POST', `/${endpoint}`, body, signal);
    if (!response.ok) return response;
    const actionId = readActionId(response.value);
    if (actionId !== undefined) {
      const waited = await this.waitForActionAsync(token, actionId, signal);
      if (!waited.ok) return waited;
    }
    const value = readCreatedHetznerResource(response.value, resourceId);
    const parsed = value === undefined ? undefined : parseHetznerResource(value, resourceId);
    return parsed === undefined ? apiFailure('hetzner-api-response-invalid') : apiSuccess(parsed);
  }

  private async waitForActionAsync(
    token: string,
    actionId: number,
    signal?: AbortSignal,
  ): Promise<InfraResult<null>> {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (signal?.aborted === true) return apiFailure('hetzner-action-aborted');
      const response = await this.requestAsync(
        token,
        'GET',
        `/actions/${actionId}`,
        undefined,
        signal,
      );
      if (!response.ok) return response;
      const status = readActionStatus(response.value);
      if (status === 'success') return apiSuccess(null);
      if (status === 'error') return apiFailure('hetzner-action-failed');
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    return apiFailure('hetzner-action-timeout');
  }

  private async requestAsync(
    token: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Readonly<Record<string, unknown>>,
    signal?: AbortSignal,
  ): Promise<InfraResult<unknown>> {
    try {
      const response = await this.fetcher(`${this.endpoint}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal === undefined ? {} : { signal }),
      });
      if (!response.ok) return apiFailure('hetzner-api-request-failed');
      return apiSuccess(response.status === 204 ? null : await response.json());
    } catch {
      return apiFailure('hetzner-api-request-failed');
    }
  }
}
