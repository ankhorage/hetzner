import type {
  InfraOutput,
  InfraOwnedResource,
  InfraResourceStatus,
} from '@ankhorage/contracts/infra';

import type {
  HetznerCloudObservation,
  HetznerProjectIdentity,
  HetznerResourceObservation,
} from '../../../types/hetznerCompute';
import { createHetznerOwner } from '../utils/hetznerOwnership';

export function toOwnedResources(
  identity: HetznerProjectIdentity,
  observation: HetznerCloudObservation,
): readonly InfraOwnedResource[] {
  return observation.resources.map((resource) => ({
    ...createHetznerOwner(identity, resource.resourceId),
    externalId: resource.externalId,
  }));
}

export function toStatuses(
  identity: HetznerProjectIdentity,
  observation: HetznerCloudObservation,
): readonly InfraResourceStatus[] {
  return observation.resources.map((resource) => ({
    owner: createHetznerOwner(identity, resource.resourceId).identity,
    state: resource.state,
  }));
}

export function toPublicOutputs(
  identity: HetznerProjectIdentity,
  observation: HetznerCloudObservation,
): readonly InfraOutput[] {
  const server = observation.resources.find(hasPublicAddress);
  return server === undefined
    ? []
    : [
        {
          owner: createHetznerOwner(identity, 'server').identity,
          name: 'publicIpv4',
          visibility: 'public',
          value: server.publicIpv4,
          environmentVariable: 'ANKHORAGE_SERVER_IPV4',
        },
      ];
}

function hasPublicAddress(
  resource: HetznerResourceObservation,
): resource is HetznerResourceObservation & { readonly publicIpv4: string } {
  return resource.resourceId === 'server' && resource.publicIpv4 !== undefined;
}
