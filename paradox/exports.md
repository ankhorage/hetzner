# Public API

## createInfraAdapter

Kind: `function`
Module: `src/features/cloud-compute/composition/createInfraAdapter.ts`
Source: `src/features/cloud-compute/composition/createInfraAdapter.ts:13:1`

Create the canonical Hetzner Cloud compute adapter entrypoint.

The foundation exposes the released Contracts boundary and fails lifecycle calls explicitly
until the provider implementation phase supplies its external adapters.

### Signatures

- `() => InfraComputeAdapter<"hetzner">`
  - returns: `InfraComputeAdapter<"hetzner">`

## infraAdapterDescriptor

Kind: `value`
Module: `src/constants/infra.ts`
Source: `src/constants/infra.ts:5:14`
