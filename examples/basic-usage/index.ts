import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/hetzner';

const adapter = createInfraAdapter();

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
