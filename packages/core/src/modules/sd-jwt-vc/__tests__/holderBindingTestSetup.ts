import { Agent, DidKey, DidsModule, KeyDidRegistrar, KeyDidResolver, TypedArrayEncoder } from '@credo-ts/core'
import { transformSeedToPrivateJwk } from '../../../../../askar/src'
import { getAgentOptions } from '../../../../tests'
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

  const importDidKey = async (seed: string, legacyKid = false) => {
    const privateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromUtf8String(seed),
      type: { crv: 'Ed25519', kty: 'OKP' },
    }).privateJwk
    if (legacyKid) {
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
  const service = agent.context.dependencyManager.resolve(SdJwtVcService)

  return { agent, service, issuer, holder }
}
