<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo WebVh Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/openwallet-foundation/credo-ts/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@credo-ts/webvh"
    ><img
      alt="@credo-ts/anoncreds version"
      src="https://img.shields.io/npm/v/@credo-ts/webvh"
  /></a>

</p>
<br />

### Quick start

In order for this module to work, we have to inject it into the agent to access agent functionality. See the example for more information.

### Example of usage
#### Module Registration

To use the WebVh module, register it with your agent instance. Below is an example of how to configure the agent with the WebVh AnonCreds registry, DID resolver, and DID registrar:

```typescript
import { Agent, DidsModule, AnonCredsModule } from '@credo-ts/core'
import { WebVhAnonCredsRegistry, WebvhDidResolver, WebVhDidRegistrar } from '@credo-ts/webvh'

const agent = new Agent({
  config: options.config,
  dependencies: options.dependencies,
  modules: {
    anoncreds: new AnonCredsModule({
      registries: [
        new WebVhAnonCredsRegistry(),
      ],
    }),
    dids: new DidsModule({
      resolvers: [ new WebvhDidResolver() ],
      registrars: [ new WebVhDidRegistrar() ],
    }),
  }
})

await agent.initialize()
```

#### Creating and Updating a `did:webvh` DID

You can create and update a `did:webvh` DID using the agent's DID API.
When creating a DID, you should also store the resulting record along with its metadata and tags for easier retrieval later.

```typescript
const { didState } = await agent.dids.create({ method: 'webvh', domain })
const { did: publicDid, didDocument } = didState

if (!publicDid || !didDocument) {
  if (didState.state === 'failed') {
    agent.config.logger.error(`Failed to create did:webvh record: ${didState.reason}`)
  }
}
```

#### Persisting the DID Record
Internally, every created or updated DID is persisted as a record.
This involves storing both the DID document and its metadata so that consumers can later retrieve the associated artifacts.

For example, when a did:webvh DID is created, the following structure is saved:
```typescript
const didRecord = new DidRecord({
  did: publicDid,
  didDocument,
  role: DidDocumentRole.Created,
})

didRecord.metadata.set('log', log)
didRecord.setTags({ domain })
```

#### Locating `did:webvh` Artifacts

The artifacts associated with the DID (such as the `did.jsonl`) are stored in the record metadata under the key `log`.
This means that after creation or update, consumers of the record must retrieve the artifact from the metadata instead of expecting it to be directly attached to the `didDocument`.

The following example demonstrates how to expose the did.jsonl through an API endpoint.
The endpoint retrieves the artifact from the DID record metadata and serves it to the client:
```typescript
@Get('/.well-known/did.jsonl')
async getDidLog(@Res() res: Response) {
  const agent = await this.agentService.getAgent()
  const [didRecord] = await agent.dids.getCreatedDids({ did: agent.did })
  const didLog = didRecord.metadata.get('log') as DIDLog[] | null

  if (didLog) {
    res.setHeader('Content-Type', 'text/jsonl; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.send(didLog?.map(entry => JSON.stringify(entry)).join('\n'))
  } else {
    throw new HttpException('DID Log not found', HttpStatus.NOT_FOUND)
  }
}
```

#### Querying for Existing Records

To retrieve an existing `did:webvh` record, you can query the repository by its domain and method:

```typescript
const webVhdDidRecord = await didRepository.findSingleByQuery(agentContext, {
  domain: parsed.id,
  method: 'webvh',
})
```

### Registering AnonCreds Objects

The AnonCreds module allows registering schemas, credential definitions, revocation registry definitions, and revocation status lists. 
At present, all AnonCreds-related resources are placed under the `resources` subpath. While this convention is illustrated in the examples, it is not explicitly defined in the DID Web AnonCreds method specification. It is therefore important to be aware that this is the current implementation detail, and future revisions may further clarify or expand this structure.

#### Example

```typescript
const { schemaState, registrationMetadata: schemaMetadata } =
  await agent.modules.anoncreds.registerSchema({
    schema: {
      attrNames: options.attributes,
      name: options.name,
      version: options.version,
      issuerId,
    },
    options: {},
  })
```

#### Returned Metadata

Object registration methods return three key components:

* **objectState** - Includes the registered object and its unique identifier (`{issuerId}/resources/{resourceId}`).
* **objectMetadata** - Contains the attestedResource, which must be hosted under `/resources/{resourceId}` for verification and interoperability.
* **objectAdditionalMetadata** - Currently empty, reserved for future use.

#### Resolving Resources

In order to expose attested resources associated with a `did:webvh` DID, it is necessary to serve them through a REST endpoint such as:

```
GET /resources/:resourceId
```

This allows external parties to retrieve the resource using its identifier.

The following example demonstrates how such an endpoint could be implemented. Note that in this case the attested resources are stored in **generic records** for the sake of simplicity. This is not a requirement: implementers may use their own persistence layer as appropriate.

```typescript
@Get('/resources/:resourceId')
async getWebVhResources(@Param('resourceId') resourceId: string, @Res() res: Response) {
  const agent = await this.agentService.getAgent()
  const resourcePath = `${agent.did}/resources/${resourceId}`

  agent.config.logger.debug(`Requested resource ${resourceId}`)

  if (!resourceId) {
    throw new HttpException('resourceId not found', HttpStatus.CONFLICT)
  }
  if (!agent.did) {
    throw new HttpException('Agent does not have any defined public DID', HttpStatus.NOT_FOUND)
  }

  const [record] = await agent.genericRecords.findAllByQuery({
    attestedResourceId: resourcePath,
    type: 'AttestedResource',
  })
  if (!record) {
    throw new HttpException('No entry found for resource', HttpStatus.NOT_FOUND)
  }

  res.send(record.content)
}
```

#### Registering Attested Resources

When registering an attested resource, the resulting metadata (`registrationMetadata`) should also be persisted so that it can later be resolved through the `/resources/:resourceId` endpoint.

Again, this example stores the information in **generic records** purely for demonstration purposes. Implementers are free to adopt different storage mechanisms.

```typescript
await agent.genericRecords.save({
  id: utils.uuid(),
  content: registrationMetadata,
  tags: { 
    attestedResourceId: registrationMetadata.id as string, 
    type: 'AttestedResource' 
  },
})
```