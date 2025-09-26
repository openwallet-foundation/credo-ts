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
    res.setHeader('Content-Type', 'application/jsonl; charset=utf-8')
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

#### Resolving Resources

To resolve a resource associated with a `did:webvh` DID:

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
