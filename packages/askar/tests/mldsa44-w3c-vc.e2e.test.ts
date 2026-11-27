import { Agent, ClaimFormat, type W3cV2Credential, W3cV2DataIntegrityVerifiableCredential } from '@credo-ts/core'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { agentDependencies, getAgentConfig, getAskarStoreConfig } from '../../core/tests'
import { AskarModule } from '../src/AskarModule'

describe('ML-DSA-44 W3C VC 2.0 integration', () => {
  const issuerOptions = {
    config: getAgentConfig('Mldsa44W3cVcIssuer'),
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        askar: NativeAskar,
        store: getAskarStoreConfig('Mldsa44W3cVcIssuer'),
      }),
    },
  }
  const verifierOptions = {
    config: getAgentConfig('Mldsa44W3cVcVerifier'),
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        askar: NativeAskar,
        store: getAskarStoreConfig('Mldsa44W3cVcVerifier'),
      }),
    },
  }

  let issuer: Agent<typeof issuerOptions.modules>
  let verifier: Agent<typeof verifierOptions.modules>

  afterAll(async () => {
    if (verifier) await verifier.shutdown()
    if (issuer) await issuer.shutdown()
  })

  test('signs with the issuer key and verifies using only its resolvable public DID', async () => {
    issuer = new Agent(issuerOptions)
    verifier = new Agent(verifierOptions)
    await issuer.initialize()
    await verifier.initialize()

    const didResult = await issuer.dids.create({
      method: 'key',
      options: { createKey: { type: { kty: 'AKP', alg: 'ML-DSA-44' } } },
    })
    if (didResult.didState.state !== 'finished') throw new Error('Unable to create ML-DSA-44 issuer DID')

    const issuerDid = didResult.didState.did
    const verificationMethod = didResult.didState.didDocument?.verificationMethod?.[0]?.id
    if (!verificationMethod) throw new Error('Issuer DID has no verification method')

    const [issuerDidRecord] = await issuer.dids.getCreatedDids({ did: issuerDid })
    const issuerKeyId = issuerDidRecord?.keys?.[0]?.kmsKeyId
    if (!issuerKeyId) throw new Error('Issuer DID has no associated KMS key')

    await expect(verifier.dids.getCreatedDids({ did: issuerDid })).resolves.toHaveLength(0)
    await expect(verifier.kms.getPublicKey({ keyId: issuerKeyId })).rejects.toThrow()

    const signedCredential = await issuer.w3cV2Credentials.signCredential({
      format: ClaimFormat.DiVc,
      cryptosuite: 'mldsa44-jcs-2024',
      verificationMethod,
      credential: {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: 'urn:example:credential:ml-dsa-44',
        type: ['VerifiableCredential', 'ExampleCredential'],
        issuer: issuerDid,
        credentialSubject: { id: 'did:example:subject', name: 'Ada Lovelace' },
      } as unknown as W3cV2Credential,
    })

    if (signedCredential.claimFormat !== ClaimFormat.DiVc) throw new Error('Expected a DI VC')
    expect(signedCredential.securedCredential.proof).toMatchObject({
      type: 'DataIntegrityProof',
      cryptosuite: 'mldsa44-jcs-2024',
      proofPurpose: 'assertionMethod',
      verificationMethod,
    })

    const validResult = await verifier.w3cV2Credentials.verifyCredential({
      credential: signedCredential as W3cV2DataIntegrityVerifiableCredential,
    })
    expect(validResult.isValid).toBe(true)
    expect(validResult.validations.signature?.isValid).toBe(true)

    const alteredCredential = W3cV2DataIntegrityVerifiableCredential.fromObject({
      ...signedCredential.securedCredential,
      credentialSubject: { id: 'did:example:subject', name: 'Grace Hopper' },
    })
    const alteredResult = await verifier.w3cV2Credentials.verifyCredential({
      credential: alteredCredential as W3cV2DataIntegrityVerifiableCredential,
    })
    expect(alteredResult.isValid).toBe(false)
    expect(alteredResult.validations.signature?.isValid).toBe(false)
  })
})
