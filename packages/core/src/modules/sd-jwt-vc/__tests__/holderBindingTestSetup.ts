import {
  Agent,
  AgentContext,
  DidDocument,
  DidKey,
  DidsModule,
  KeyDidRegistrar,
  KeyDidResolver,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { vi } from 'vitest'
import { transformSeedToPrivateJwk } from '../../../../../askar/src'
import { getAgentOptions } from '../../../../tests'
import { DidResolverService } from '../../dids/services'
import { PublicJwk } from '../../kms'
import { SdJwtVcService } from '../SdJwtVcService'

export async function createHolderBindingTestSetup(name: string) {
  const agent = new Agent(
    getAgentOptions(
      name,
      {},
      {},
      { dids: new DidsModule({ resolvers: [new KeyDidResolver()], registrars: [new KeyDidRegistrar()] }) }
    )
  )
  await agent.initialize()

  const importDidKey = async (seed: string, useBase58Kid = false) => {
    const privateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromUtf8String(seed),
      type: { crv: 'Ed25519', kty: 'OKP' },
    }).privateJwk
    if (useBase58Kid) {
      privateJwk.kid = TypedArrayEncoder.toBase58(PublicJwk.fromPublicJwk(privateJwk).publicKey.publicKey)
    }
    const key = PublicJwk.fromPublicJwk((await agent.kms.importKey({ privateJwk })).publicJwk)
    const document = new DidKey(key).didDocument
    const didUrl = document.verificationMethod?.[0]?.id
    if (!didUrl) throw new Error('Expected a DID verification method')
    await agent.dids.import({
      did: document.id,
      didDocument: document,
      keys: [{ didDocumentRelativeKeyId: `#${didUrl.split('#')[1]}`, kmsKeyId: key.keyId }],
    })
    return { key, didUrl }
  }

  const issuer = await importDidKey('00000000000000000000000000000000')
  const holder = await importDidKey('00000000000000000000000000000001', true)
  // Use the public holder key without local KMS metadata for ordinary issuance tests.
  // The imported key retains its kid for signing and credentials containing cnf.jwk.kid.
  const holderPublicJwk = PublicJwk.fromUnknown(holder.key.toJson({ includeKid: false }))
  const service = agent.context.dependencyManager.resolve(SdJwtVcService)

  return { agent, service, issuer, holder, holderPublicJwk }
}

export async function useAuthenticationOnlyDid(agentContext: AgentContext, key: PublicJwk) {
  const didDocument = new DidKey(key).didDocument
  const did = didDocument.id
  const authenticationOnlyDocument = new DidDocument({
    id: did,
    verificationMethod: didDocument.verificationMethod,
    authentication: didDocument.authentication,
  })
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
  const resolveDidDocument = didResolver.resolveDidDocument.bind(didResolver)
  vi.spyOn(didResolver, 'resolveDidDocument').mockImplementation(async (context, requestedDid) =>
    requestedDid.split('#')[0] === did ? authenticationOnlyDocument : resolveDidDocument(context, requestedDid)
  )
  await didResolver.invalidateCacheForDid(agentContext, did)
}
