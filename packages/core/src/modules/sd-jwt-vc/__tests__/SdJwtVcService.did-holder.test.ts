import { DidKey } from '@credo-ts/core'
import { PublicJwk } from '../../kms'
import { createHolderBindingTestSetup } from './holderBindingTestSetup'

describe('SdJwtVcService DID holder binding', () => {
  let setup: Awaited<ReturnType<typeof createHolderBindingTestSetup>>

  beforeAll(async () => {
    setup = await createHolderBindingTestSetup('sdjwtvc-did-holder')
  })

  test('does not sign a presentation for an unregistered holder DID even if its key exists in KMS', async () => {
    const { agent, service, issuer } = setup
    const key = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const didUrl = new DidKey(PublicJwk.fromUnknown(key.publicJwk)).didDocument.verificationMethod?.[0]?.id
    if (!didUrl) throw new Error('Expected a DID verification method')

    // Deliberately do not call agent.dids.import: the key exists in KMS, but no created-DID record maps it to this DID.
    const credential = await service.sign(agent.context, {
      payload: { claim: 'some-claim', vct: 'IdentityCredential' },
      issuer: { method: 'did', didUrl: issuer.didUrl },
      holder: { method: 'did', didUrl },
    })
    await expect(
      service.present(agent.context, {
        sdJwtVc: credential.compact,
        verifierMetadata: {
          issuedAt: 1698151532,
          audience: 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y',
          nonce: 'unregistered-holder',
        },
      })
    ).rejects.toThrow('not found')
  })
})
