# Public API

## createFetchHetznerCloudApi

Kind: `function`
Module: `src/features/cloud-compute/adapters/outbound/createFetchHetznerCloudApi.ts`
Source: `src/features/cloud-compute/adapters/outbound/createFetchHetznerCloudApi.ts:33:1`

### Signatures

- `(options?: HetznerFetchApiOptions) => HetznerCloudApi`
  - options: `HetznerFetchApiOptions` (optional)
  - returns: `HetznerCloudApi`

## createInfraAdapter

Kind: `function`
Module: `src/features/cloud-compute/composition/createInfraAdapter.ts`
Source: `src/features/cloud-compute/composition/createInfraAdapter.ts:21:1`

Create the canonical Hetzner Cloud compute adapter.

The default composition uses the authenticated Cloud REST API and a shell-free SSH host-key
probe. Provider API and SSH credentials remain transient execution inputs.

### Signatures

- `(options?: HetznerAdapterOptions) => InfraComputeAdapter<"hetzner">`
  - options: `HetznerAdapterOptions` (optional)
  - returns: `InfraComputeAdapter<"hetzner">`

## createNodeHetznerHostKeyProbe

Kind: `function`
Module: `src/features/cloud-compute/adapters/outbound/createNodeHetznerHostKeyProbe.ts`
Source: `src/features/cloud-compute/adapters/outbound/createNodeHetznerHostKeyProbe.ts:9:1`

### Signatures

- `() => HetznerHostKeyProbe`
  - returns: `HetznerHostKeyProbe`

## HetznerAdapterOptions

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:76:1`

### Members

| Name         | Kind     | Type                               | Required | Description |
| ------------ | -------- | ---------------------------------- | -------- | ----------- |
| api          | property | `HetznerCloudApi \| undefined`     | no       |             |
| hostKeyProbe | property | `HetznerHostKeyProbe \| undefined` | no       |             |

## HetznerCloudApi

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:48:1`

### Members

| Name           | Kind   | Type                                                                                                                                                                  | Required | Description |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| destroyAsync   | method | `(token: string, identity: HetznerProjectIdentity, resourceIds: readonly HetznerResourceId[], signal?: AbortSignal) => Promise<InfraResult<HetznerCloudObservation>>` | yes      |             |
| inspectAsync   | method | `(token: string, identity: HetznerProjectIdentity, signal?: AbortSignal) => Promise<InfraResult<HetznerCloudObservation>>`                                            | yes      |             |
| reconcileAsync | method | `(token: string, desired: HetznerDesiredCompute, signal?: AbortSignal) => Promise<InfraResult<HetznerCloudObservation>>`                                              | yes      |             |
| validateAsync  | method | `(token: string, selection: InfraComputeSelection<"hetzner">, signal?: AbortSignal) => Promise<InfraResult<null>>`                                                    | yes      |             |

## HetznerCloudObservation

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:44:1`

### Members

| Name      | Kind     | Type                                    | Required | Description |
| --------- | -------- | --------------------------------------- | -------- | ----------- |
| resources | property | `readonly HetznerResourceObservation[]` | yes      |             |

## HetznerDesiredCompute

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:21:1`

### Members

| Name         | Kind     | Type                     | Required | Description |
| ------------ | -------- | ------------------------ | -------- | ----------- |
| firewall     | property | `HetznerDesiredResource` | yes      |             |
| identity     | property | `HetznerProjectIdentity` | yes      |             |
| image        | property | `string`                 | yes      |             |
| location     | property | `string`                 | yes      |             |
| network      | property | `HetznerDesiredResource` | yes      |             |
| server       | property | `HetznerDesiredResource` | yes      |             |
| serverType   | property | `string`                 | yes      |             |
| sshKey       | property | `HetznerDesiredResource` | yes      |             |
| sshPort      | property | `number`                 | yes      |             |
| sshPublicKey | property | `string`                 | yes      |             |
| sshUser      | property | `string`                 | yes      |             |

## HetznerFetchApiOptions

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:81:1`

### Members

| Name           | Kind     | Type                        | Required | Description |
| -------------- | -------- | --------------------------- | -------- | ----------- |
| endpoint       | property | `string \| undefined`       | no       |             |
| fetch          | property | `typeof fetch \| undefined` | no       |             |
| pollIntervalMs | property | `number \| undefined`       | no       |             |

## HetznerHostKeyProbe

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:72:1`

### Members

| Name             | Kind   | Type                                                                                 | Required | Description |
| ---------------- | ------ | ------------------------------------------------------------------------------------ | -------- | ----------- |
| fingerprintAsync | method | `(host: string, port: number, signal?: AbortSignal) => Promise<InfraResult<string>>` | yes      |             |

## HetznerProjectIdentity

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:10:1`

### Members

| Name        | Kind     | Type                                   | Required | Description |
| ----------- | -------- | -------------------------------------- | -------- | ----------- |
| environment | property | `"local" \| "preview" \| "production"` | yes      |             |
| projectId   | property | `string`                               | yes      |             |

## HetznerResourceId

Kind: `unknown`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:8:1`

## HetznerResourceObservation

Kind: `type`
Module: `src/types/hetznerCompute.ts`
Source: `src/types/hetznerCompute.ts:35:1`

### Members

| Name              | Kind     | Type                                                                       | Required | Description |
| ----------------- | -------- | -------------------------------------------------------------------------- | -------- | ----------- |
| architecture      | property | `"amd64" \| "arm64" \| undefined`                                          | no       |             |
| configurationHash | property | `string \| undefined`                                                      | no       |             |
| externalId        | property | `string`                                                                   | yes      |             |
| publicIpv4        | property | `string \| undefined`                                                      | no       |             |
| resourceId        | property | `HetznerResourceId`                                                        | yes      |             |
| state             | property | `"pending" \| "ready" \| "stopped" \| "degraded" \| "failed" \| "unknown"` | yes      |             |

## infraAdapterDescriptor

Kind: `value`
Module: `src/constants/infra.ts`
Source: `src/constants/infra.ts:5:14`
