<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo did:webvh Module</b></h1>
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

Register `WebVhModule` with your agent to automatically enable `agent.dids.create`, `resolve`, `update`, and `deactivate`. No manual WebVH resolver or registrar registration is required. Below is an example including the optional AnonCreds registry:

`@credo-ts/anoncreds` is an optional peer dependency of `@credo-ts/webvh`. Install it explicitly when using
`@credo-ts/webvh/anoncreds`; it is not required when using only WebVH DID and resource functionality.

```typescript
import { Agent } from '@credo-ts/core'
import { AnonCredsModule } from '@credo-ts/anoncreds'
import { WebVhAnonCredsRegistry } from '@credo-ts/webvh/anoncreds'
import { WebVhModule } from '@credo-ts/webvh'

const agent = new Agent({
  config: options.config,
  dependencies: options.dependencies,
  modules: {
    anoncreds: new AnonCredsModule({
      registries: [
        new WebVhAnonCredsRegistry(),
      ],
    }),
    webvh: new WebVhModule(),
  }
})

await agent.initialize()
```

An explicitly configured `WebVhDidResolver` and an existing registrar supporting `webvh` are preserved. Controller operations returning `didState.state: 'finished'` have signed and persisted local state only; required witnessing and publication remain application-owned. Publish logs and proofs before normal DID resolution.

#### Resolving DID-Linked Resources With the WebVH API

`WebVhModule` exposes a context-scoped `WebVhApi` via `agent.modules.<key>`. It bridges Credo's storage, KMS, crypto adapters, and configured fetch to didwebvh-ts. `resolveResource()` dereferences a DID-linked resource URL (for example a schema or credential definition stored under a `did:webvh` DID). The API also exposes controller publication data and KMS-backed witness signing; ordinary DID lifecycle operations stay on `agent.dids`. Applications coordinate witness agents, collect approvals, and publish logs and proofs; the module does not orchestrate these workflows.

> Note: `webvh` is the module key used in these examples. You can choose another key and access the API through that same key.

```typescript
const result = await agent.modules.webvh.resolveResource(
  `${publicDid}/resources/${resourceId}`
)

if ('error' in result) {
  throw new Error(result.message)
}

// For JSON resources, result.content is the parsed object.
// For non-JSON resources, result.content is text.
const resourceContent = result.content
```

#### Creating and Updating a `did:webvh` DID

Create keys through `agent.kms` and author the complete DID document before calling the DID API.
Credo does not generate verification methods, fragments, or verification relationships. The library replaces creation-time `{DID}` and `{SCID}` placeholders.

```typescript
import { DidDocument, Kms } from '@credo-ts/core'
import type { WebVhDidCreateOptions, WebVhDidUpdateOptions } from '@credo-ts/webvh'

const controllerKey = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
const assertionKey = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
const controllerMultikey = Kms.PublicJwk.fromPublicJwk(controllerKey.publicJwk).fingerprint
const assertionMultikey = Kms.PublicJwk.fromPublicJwk(assertionKey.publicJwk).fingerprint

const createOptions: WebVhDidCreateOptions = {
  method: 'webvh',
  didDocument: DidDocument.fromJSON({
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: '{DID}',
    verificationMethod: [{
      id: '{DID}#issuer-key',
      type: 'Multikey',
      controller: '{DID}',
      publicKeyMultibase: assertionMultikey,
    }],
    authentication: ['{DID}#issuer-key'],
    assertionMethod: ['{DID}#issuer-key'],
  }),
  options: {
    address: 'issuer.example.com',
    paths: ['issuers', '01'],
    updateKeys: [controllerMultikey],
    keys: [{ didDocumentRelativeKeyId: '#issuer-key', kmsKeyId: assertionKey.keyId }],
    updateKeyKmsKeyIds: { [controllerMultikey]: controllerKey.keyId },
  },
}

const { didState } = await agent.dids.create(createOptions)
if (didState.state !== 'finished') throw new Error(JSON.stringify(didState))
const { did: publicDid, didDocument } = didState

const updateOptions: WebVhDidUpdateOptions = {
  did: publicDid,
  didDocument, // Complete replacement document, including all relationships to retain.
  options: { watchers: ['https://watcher.example.com'] },
}
const updated = await agent.dids.update(updateOptions)
if (updated.didState.state !== 'finished') throw new Error(JSON.stringify(updated.didState))
```

`options.keys` uses core `DidDocumentKey[]` and contains only document keys managed by this agent.
Controller keys are separate: `options.updateKeyKmsKeyIds` maps bare Ed25519 multikeys to existing KMS IDs, even when those keys are absent from the document. Supplied mappings are checked against KMS public material. No registrar `createKey` or single-key generated-document mode is provided.

Every update requires a complete `DidDocument`; partial documents, omitted documents, and `addToDidDocument`/`removeFromDidDocument` are unsupported. Omitted relationships are not repaired. An omitted `options.keys` retains only mappings whose fragment and public material still match the returned document; supplying it replaces the document-key list. New controller mappings merge into persisted mappings. Under pre-rotation, the signer must be one of the caller-supplied pre-committed replacement `updateKeys`.

To deactivate while pre-rotation is active, first perform a separate full-document update with the pre-committed `updateKeys`, their KMS mappings, and `nextKeyHashes: []`, then call `agent.dids.deactivate({ did: publicDid })`. For witnessed DIDs, collect and publish the intervening update's witness proofs before deactivating. Credo never performs that sequence automatically.

#### Resolution and Upgrade Compatibility

This module requires Node.js >=22.12.0 and uses didwebvh-ts 3.1.0. Replace the old top-level `domain`/`path` create fields with nested `options.address`/`options.paths`.

Resolution preserves upstream document metadata, errors, messages, and `problemDetails`, including a valid historical document returned alongside an error in later history. `didDocumentMetadata.witness.threshold` is a string; writer/controller metadata keeps numeric thresholds. Always inspect `didResolutionMetadata.error`, even when a document is returned.

Valid published deactivation is not a resolution error: upstream returns `didDocument: null` with `didDocumentMetadata.deactivated: true`. Check both `didResolutionMetadata.error` and `didDocumentMetadata.deactivated`; a null document alone does not distinguish deactivation from failure. Invalid deactivation history, including missing required witness approvals, retains upstream validation errors and details.

All DID resolution uses published logs through upstream's `getResolver` registry and `did-resolver` dispatcher, including its WebVH parser hook and version selectors such as `?versionNumber=1`, `?versionId=...`, and `?versionTime=...`. Newly created or updated DIDs must be published before `agent.dids.resolve` sees them; stored documents and proofs are not substituted for published data. Generic core caching/local-document shortcuts and upstream dispatcher caching are disabled. All network retrieval, including resources and witness proofs, uses the agent's configured fetch and `fetchLimits`; set `fetchLimits.maxResponseBytes` on the agent rather than a WebVH-specific resolver limit.

Use `agent.dids.resolve(didUrl)` for resolution. Direct `WebVhDidResolver.resolve` calls require Credo's parsed DID URL as the third argument so the original `didUrl` can be forwarded to upstream's dispatcher. The adapter does not interpret version selectors itself. Resource URL conversion remains in the adapter until upstream exposes it publicly.

To validate an unpublished log explicitly, call `agent.modules.webvh.resolveDIDFromLog(log, { witnessProofs })`, passing any required proofs. It delegates log validation to upstream and returns a Credo document with upstream resolution metadata. Optional upstream version selectors are supported. This does not publish or store the log.

Logs declaring did:webvh:0.5, malformed SCIDs, raw-Unicode DIDs, and single-label hosts such as `localhost` are rejected upstream. Re-issue affected DIDs at a fully qualified host using `create`; they cannot be fixed by changing local fixtures. Witness-list replacements written by 2.7.3/2.7.4 that fail the previous-list approval rule remain rejected, as they already were in 2.8.0. Existing valid percent-encoded U-label logs continue resolving; new DIDs use canonical A-label hosts. On runtimes without IDNA support, supply A-label addresses.

#### Persisting the DID Record

The registrar persists every completed lifecycle operation in its existing `DidRecord`, including the authoritative returned DID, document, log, controller metadata, and KMS mappings. No application-side duplicate record save is required.

Use the WebVH API to retrieve detached publication data and persist the complete witness proof file collected by the application:

```typescript
const { log, witnessProofs } = await agent.modules.webvh.getPublicationData(publicDid)
// Serialize log entries as JSONL for did.jsonl, and witnessProofs as JSON for did-witness.json.

await agent.modules.webvh.storeWitnessProofs(publicDid, collectedWitnessProofs)
```

`storeWitnessProofs` replaces the entire stored proof file; it does not append or merge. Include proofs for earlier log entries that remain required. Passing `[]` clears the file. It does not change the DID log or claim that witness requirements are satisfied. The application handles witness discovery, requests, response collection, verification where needed, and publication.

Inspect requirements and verify collected proofs before storing or publishing. Import context-free utilities directly from didwebvh-ts:

```typescript
import { deriveNextKeyHash, getWitnessRequirements } from 'didwebvh-ts'

const requirements = getWitnessRequirements(log)
const verification = await agent.modules.webvh.verifyWitnessProofs({ log, witnessProofs: collectedWitnessProofs })
// Inspect verification.verified, requirements, and rejectedProofs.
const publishedProofs = await agent.modules.webvh.fetchWitnessProofs(publicDid)
const nextKeyHash = await deriveNextKeyHash(replacementControllerMultikey)
```

Requirement inspection does not verify signatures. Proof verification is local, returns per-entry approval and rejection details, and does not fetch or persist proofs. Fetching published proofs uses Credo's configured fetch and limits, returns `[]` for HTTP 404, and does not contact witness agents.

For an existing portable percent-encoded U-label DID, use `agent.modules.webvh.migrate({ did, didDocument, options: { address: existingULabelAddress } })` to append the upstream A-label migration entry. This specialized operation lives on the WebVH API, not the DID registrar; `agent.dids.update` performs ordinary updates only. Supply a complete replacement document and, when needed, KMS mapping and pre-rotation options. The adapter authenticates controller keys and persists the returned DID, document, log, metadata, and mappings. Inspect `didState` for failure; witnessing and publication remain caller-managed. Ordinary create, update, deactivate, and resolution remain available through Credo's DID API.

An independent witness agent can sign a candidate using its existing Ed25519 KMS key:

```typescript
const proofEntry = await witnessAgent.modules.webvh.signWitnessProof({
  trustedLog, // [] for genesis.
  candidateLog, // Trusted history plus exactly one new candidate entry.
  witnessProofs: priorWitnessProofs, // Explicit [] when empty.
  kmsKeyId: witnessKmsKeyId,
})
```

didwebvh-ts validates the candidate and witness membership and constructs the proof. Credo supplies only KMS signing and verification; it never contacts witness agents. Bridge failures throw `CredoError` with the original cause.

#### Locating `did:webvh` Artifacts

The artifacts associated with the DID (such as the `did.jsonl`) are stored in the record metadata under the key `log`.
This means that after creation or update, consumers of the record must retrieve the artifact from the metadata instead of expecting it to be directly attached to the `didDocument`.

The following example demonstrates how to expose the did.jsonl through an API endpoint.
The endpoint retrieves the artifact from the DID record metadata and serves it to the client:

```typescript
@Get('/.well-known/did.jsonl')
async getDidLog(@Res() res: Response) {
  const agent = await this.agentService.getAgent()
  const { log } = await agent.modules.webvh.getPublicationData(agent.did)
  res.setHeader('Content-Type', 'text/jsonl; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.send(log.map(entry => JSON.stringify(entry)).join('\n'))
}
```

#### Querying for Existing Records

To retrieve an existing `did:webvh` record, you can query the repository by its domain and method:

```typescript
const webVhdDidRecord = await didRepository.findSingleByQuery(agentContext, {
  domain: 'issuer.example.com:issuers:01',
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

```text
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
