import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { ConsoleLogger, LogLevel } from '../../../../logger'
import type { JsonObject } from '../../../../types'
import { JsonEncoder } from '../../../../utils'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import {
  DidDocumentBuilder,
  DidRepository,
  DidsModuleConfig,
  getJsonWebKey2020,
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
} from '../../../dids'
import {
  Ed25519PublicJwk,
  KeyManagementApi,
  P256PublicJwk,
  P384PublicJwk,
  PublicJwk,
  Secp256k1PublicJwk,
} from '../../../kms'
import { JsonLdModuleConfig } from '../../jsonld'
import { ClaimFormat, W3cCredential } from '../../models'
import type { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cJsonLdVerifiableCredential } from '../models/W3cJsonLdVerifiableCredential'
import { SignatureSuiteRegistry } from '../SignatureSuiteRegistry'
import { JsonWebSignature2020 } from '../signature-suites'
import { W3cJsonLdCredentialService } from '../W3cJsonLdCredentialService'
import { customDocumentLoader, DOCUMENTS } from './documentLoader'
import { VERAMO_JSON_WEB_SIGNATURE_2020 } from './veramoJsonWebSignature2020'

const documents = DOCUMENTS as Record<string, JsonObject>

const signatureSuiteRegistry = new SignatureSuiteRegistry([
  {
    suiteClass: JsonWebSignature2020,
    proofType: 'JsonWebSignature2020',
    verificationMethodTypes: [VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020],
    supportedPublicJwkTypes: [Ed25519PublicJwk, P256PublicJwk, P384PublicJwk, Secp256k1PublicJwk],
  },
])

// biome-ignore lint/suspicious/noExplicitAny: no explanation
const inMemoryStorage = new InMemoryStorageService<any>()
const agentContext = getAgentContext({
  agentConfig: getAgentConfig('JsonWebSignature2020Test'),
  registerInstances: [
    [InjectionSymbols.Logger, new ConsoleLogger(LogLevel.Off)],
    [DidsModuleConfig, new DidsModuleConfig({})],
    [DidRepository, new DidRepository(inMemoryStorage, new EventEmitter(agentDependencies, new Subject()))],
  ],
})

const service = new W3cJsonLdCredentialService(
  signatureSuiteRegistry,
  new JsonLdModuleConfig({ documentLoader: customDocumentLoader })
)

let counter = 0
// Creates a did whose only verification method is a JsonWebKey2020 for a new key in the KMS
async function createIdentity(
  type: { kty: 'OKP'; crv: 'Ed25519' } | { kty: 'EC'; crv: 'P-256' | 'P-384' | 'secp256k1' }
) {
  const kms = agentContext.resolve(KeyManagementApi)
  const key = await kms.createKey({ type })
  const did = `did:example:jws2020${counter++}`
  const verificationMethodId = `${did}#key-1`

  const didDocument = new DidDocumentBuilder(did)
    .addContext('https://www.w3.org/ns/did/v1')
    .addContext('https://w3id.org/security/suites/jws-2020/v1')
    .addVerificationMethod(
      getJsonWebKey2020({ did, publicJwk: PublicJwk.fromPublicJwk(key.publicJwk), verificationMethodId })
    )
    .addAssertionMethod(verificationMethodId)
    .addAuthentication(verificationMethodId)
    .build()

  await agentContext.resolve(DidRepository).storeCreatedDid(agentContext, {
    did,
    didDocument,
    keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: key.keyId }],
  })
  documents[did] = JsonTransformer.toJSON(didDocument) as JsonObject

  return { did, verificationMethodId }
}

const credentialFor = (issuer: string) =>
  JsonTransformer.fromJSON(
    {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      issuer,
      issuanceDate: '2017-10-22T12:23:48Z',
      credentialSubject: { degree: { type: 'BachelorDegree', name: 'Bachelor of Science and Arts' } },
    },
    W3cCredential
  )

describe('JsonWebSignature2020', () => {
  describe('a credential signed by Veramo', () => {
    const { did, didDocument, definedTerms, undefinedTerms } = VERAMO_JSON_WEB_SIGNATURE_2020

    beforeAll(() => {
      documents[did] = didDocument as JsonObject
    })

    const verify = (credential: unknown) =>
      service.verifyCredential(agentContext, {
        credential: JsonTransformer.fromJSON(credential, W3cJsonLdVerifiableCredential),
      })

    it('verifies when its claims are defined by its contexts', async () => {
      const result = await verify(definedTerms)
      expect(result.isValid, result.isValid ? '' : String(result.error)).toBe(true)
    })

    it('does not verify once a claim is changed', async () => {
      const changed = JSON.parse(JSON.stringify(definedTerms))
      changed.credentialSubject.name = 'Mallory'
      expect((await verify(changed)).isValid).toBe(false)
    })

    describe('with allowUndefinedTerms', () => {
      const verifyLenient = async (credential: unknown) => {
        const result = await service.verifyCredential(agentContext, {
          credential: JsonTransformer.fromJSON(credential, W3cJsonLdVerifiableCredential),
          allowUndefinedTerms: true,
        })
        return {
          isValid: result.isValid,
          undefinedTerms: (result.validations.vcJs as { undefinedTerms?: string[] } | undefined)?.undefinedTerms,
        }
      }

      it('verifies a credential with an undefined term and lists the term', async () => {
        expect(await verifyLenient(undefinedTerms)).toEqual({ isValid: true, undefinedTerms: ['name'] })
      })

      // This is the hazard, shown on purpose: the value of the undefined term is not signed, so changing it does not
      // invalidate the credential. The caller must treat every listed term as unverified.
      it('still verifies when the value of the undefined term is changed, and still lists the term', async () => {
        const changed = JSON.parse(JSON.stringify(undefinedTerms))
        changed.credentialSubject.name = 'Mallory'
        expect(await verifyLenient(changed)).toEqual({ isValid: true, undefinedTerms: ['name'] })
      })

      it('lists nothing and still protects every claim for a credential whose terms are all defined', async () => {
        expect(await verifyLenient(definedTerms)).toEqual({ isValid: true, undefinedTerms: [] })

        const changed = JSON.parse(JSON.stringify(definedTerms))
        changed.credentialSubject.name = 'Mallory'
        expect((await verifyLenient(changed)).isValid).toBe(false)
      })

      it('does not accept a changed signature, whatever the terms', async () => {
        const changed = JSON.parse(JSON.stringify(undefinedTerms))
        changed.proof.jws = `${changed.proof.jws.slice(0, -4)}AAAA`
        expect((await verifyLenient(changed)).isValid).toBe(false)
      })
    })

    // Veramo accepts these, including with a changed claim, because the claim is not covered by the signature.
    // Credo's JSON-LD verification is strict and refuses them.
    it('does not verify when a claim is not defined by any context', async () => {
      const result = await verify(undefinedTerms)
      expect(result.isValid).toBe(false)
      expect(String(result.error)).toContain('Verification error')
    })
  })

  describe.each([
    { name: 'Ed25519', type: { kty: 'OKP', crv: 'Ed25519' }, alg: 'EdDSA' },
    { name: 'P-256', type: { kty: 'EC', crv: 'P-256' }, alg: 'ES256' },
    { name: 'P-384', type: { kty: 'EC', crv: 'P-384' }, alg: 'ES384' },
    { name: 'secp256k1', type: { kty: 'EC', crv: 'secp256k1' }, alg: 'ES256K' },
  ] as const)('a credential signed with a $name key', ({ type, alg }) => {
    it('signs with the algorithm of the key and verifies', async () => {
      const { did, verificationMethodId } = await createIdentity(type)

      const vc = await service.signCredential(agentContext, {
        format: ClaimFormat.LdpVc,
        credential: credentialFor(did),
        proofType: 'JsonWebSignature2020',
        verificationMethod: verificationMethodId,
      })

      const proof = (Array.isArray(vc.proof) ? vc.proof[0] : vc.proof) as LinkedDataProof
      expect(proof.type).toBe('JsonWebSignature2020')
      expect(JsonEncoder.fromBase64Url(proof.jws?.split('.')[0] as string)).toEqual({
        alg,
        b64: false,
        crit: ['b64'],
      })
      // the suite context is added to the credential
      expect(vc.contexts).toContain('https://w3id.org/security/suites/jws-2020/v1')

      const result = await service.verifyCredential(agentContext, { credential: vc })
      expect(result.isValid, result.isValid ? '' : String(result.error)).toBe(true)
    })

    it('does not verify once the claims are changed', async () => {
      const { did, verificationMethodId } = await createIdentity(type)
      const vc = await service.signCredential(agentContext, {
        format: ClaimFormat.LdpVc,
        credential: credentialFor(did),
        proofType: 'JsonWebSignature2020',
        verificationMethod: verificationMethodId,
      })

      const changed = JsonTransformer.toJSON(vc) as JsonObject
      ;(changed.credentialSubject as JsonObject).degree = { type: 'BachelorDegree', name: 'Doctor of Philosophy' }
      const result = await service.verifyCredential(agentContext, {
        credential: JsonTransformer.fromJSON(changed, W3cJsonLdVerifiableCredential),
      })
      expect(result.isValid).toBe(false)
    })
  })

  it('rejects a proof whose algorithm is not the one of the key', async () => {
    const { did, verificationMethodId } = await createIdentity({ kty: 'EC', crv: 'P-256' })
    const vc = await service.signCredential(agentContext, {
      format: ClaimFormat.LdpVc,
      credential: credentialFor(did),
      proofType: 'JsonWebSignature2020',
      verificationMethod: verificationMethodId,
    })

    // the header says EdDSA but the key in the did document is a P-256 key
    const json = JsonTransformer.toJSON(vc) as JsonObject
    const proof = json.proof as JsonObject
    const [, , signature] = (proof.jws as string).split('.')
    const header = JsonEncoder.toBase64Url({ alg: 'EdDSA', b64: false, crit: ['b64'] })
    proof.jws = `${header}..${signature}`

    const result = await service.verifyCredential(agentContext, {
      credential: JsonTransformer.fromJSON(json, W3cJsonLdVerifiableCredential),
    })
    expect(result.isValid).toBe(false)
  })

  it('does not sign with a verification method that is not a JsonWebKey2020', async () => {
    const kms = agentContext.resolve(KeyManagementApi)
    const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const did = `did:example:jws2020${counter++}`
    await agentContext.resolve(DidRepository).storeCreatedDid(agentContext, {
      did,
      didDocument: new DidDocumentBuilder(did).build(),
      keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: key.keyId }],
    })

    await expect(
      service.signCredential(agentContext, {
        format: ClaimFormat.LdpVc,
        credential: credentialFor(did),
        proofType: 'JsonWebSignature2020',
        verificationMethod: `${did}#key-1`,
      })
    ).rejects.toThrow()
  })
})
