import { randomUUID } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JsonTransformer } from '../../../utils'
import { DidKey, DidsModule, KeyDidRegistrar, KeyDidResolver } from '../../dids'
import { PublicJwk } from '../../kms'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import {
  ClaimFormat,
  W3cCredential,
  W3cCredentialRecord,
  W3cJsonLdVerifiablePresentation,
  type W3cJwtVerifiablePresentation,
} from '../../vc'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import {
  type DifPresentationExchangeDefinitionV2,
  type DifPresentationExchangeSubmission,
  DifPresentationExchangeSubmissionLocation,
} from '../models'

/**
 * An SD-JWT VC can be designated `vc+sd-jwt` and `dc+sd-jwt`, and a JWT VC `jwt_vc` and `jwt_vc_json`. A
 * presentation definition can restrict each designation differently, so the designation a credential is
 * presented under is the one it satisfies, and the verifier evaluates each descriptor under the designation
 * it names.
 *
 * A W3C presentation is signed with an algorithm or proof type the presentation format (`jwt_vp`, `jwt_vp_json` or
 * `ldp_vp`) requires, preferring one the credential format allows.
 */

const agent = new Agent(
  getAgentOptions(
    'pex-format-designations',
    {},
    {},
    { dids: new DidsModule({ resolvers: [new KeyDidResolver()], registrars: [new KeyDidRegistrar()] }) }
  )
)

describe('DIF Presentation Exchange format designations', () => {
  let pexService: DifPresentationExchangeService
  let issuerDid: string
  let issuerDidUrl: string
  let holderDid: string
  let p256HolderDid: string
  let holderKey: PublicJwk

  const challenge = 'challenge'
  const domain = 'https://verifier.example.com'

  beforeAll(async () => {
    await agent.initialize()
    pexService = agent.dependencyManager.resolve(DifPresentationExchangeService)

    const issuerKey = PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
    )
    const issuerDidDocument = new DidKey(issuerKey).didDocument
    issuerDid = issuerDidDocument.id
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      did: issuerDid,
      didDocument: issuerDidDocument,
      keys: [{ didDocumentRelativeKeyId: `#${issuerDidUrl.split('#')[1]}`, kmsKeyId: issuerKey.keyId }],
    })

    const createHolderDid = async (type: { kty: 'OKP'; crv: 'Ed25519' } | { kty: 'EC'; crv: 'P-256' }) => {
      const { didState } = await agent.dids.create({ method: 'key', options: { createKey: { type } } })
      if (!didState.did) throw new Error('Expected the holder did to be created')
      return didState.did
    }
    holderDid = await createHolderDid({ kty: 'OKP', crv: 'Ed25519' })
    p256HolderDid = await createHolderDid({ kty: 'EC', crv: 'P-256' })

    holderKey = PublicJwk.fromPublicJwk((await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  // Stores an SD-JWT VC signed with EdDSA, and returns its vct
  async function storeSdJwtVc() {
    const vct = `urn:vct:${randomUUID()}`
    const { compact } = await agent.sdJwtVc.sign({
      holder: { method: 'jwk', jwk: holderKey },
      issuer: { method: 'did', didUrl: issuerDidUrl },
      payload: { vct, given_name: 'Erika' },
      disclosureFrame: { _sd: ['given_name'] },
    })
    await agent.sdJwtVc.store({
      record: new SdJwtVcRecord({ credentialInstances: [{ compactSdJwtVc: compact, kmsKeyId: holderKey.keyId }] }),
    })

    return vct
  }

  // Stores a W3C credential for the holder signed with EdDSA, as a JWT VC or with an Ed25519Signature2018 proof,
  // and returns its type
  async function storeW3cVc(format: ClaimFormat.JwtVc | ClaimFormat.LdpVc, subjectDid = holderDid) {
    const type = `Credential${randomUUID().replaceAll('-', '')}`
    const credential = JsonTransformer.fromJSON(
      {
        '@context': ['https://www.w3.org/2018/credentials/v1', { '@vocab': 'https://example.org/vocab#' }],
        type: ['VerifiableCredential', type],
        issuer: issuerDid,
        issuanceDate: '2023-10-24T00:00:00Z',
        credentialSubject: { id: subjectDid, given_name: 'Erika' },
      },
      W3cCredential
    )
    const signed =
      format === ClaimFormat.JwtVc
        ? await agent.w3cCredentials.signCredential({
            format,
            alg: 'EdDSA',
            verificationMethod: issuerDidUrl,
            credential,
          })
        : await agent.w3cCredentials.signCredential({
            format,
            proofType: 'Ed25519Signature2018',
            verificationMethod: issuerDidUrl,
            credential,
          })
    await agent.w3cCredentials.store({ record: W3cCredentialRecord.fromCredential(signed) })

    return type
  }
  const storeJwtVc = (subjectDid?: string) => storeW3cVc(ClaimFormat.JwtVc, subjectDid)

  // The messages of the error validating the presentation throws
  function getValidationErrors(validate: () => void) {
    try {
      validate()
    } catch (error) {
      if (!(error instanceof DifPresentationExchangeError)) throw error
      return error.additionalMessages ?? []
    }
    throw new Error('Expected the presentation to be invalid')
  }

  async function present(definition: DifPresentationExchangeDefinitionV2) {
    const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
    expect(queryResult.can_be_satisfied).toBe(true)

    return pexService.createPresentation(agent.context, {
      credentialsForInputDescriptor: pexService.selectCredentialsForRequest(queryResult),
      presentationDefinition: definition,
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.External,
      challenge,
      domain,
    })
  }

  describe('holder', () => {
    test('presents an SD-JWT VC under the designation whose restrictions it satisfies', async () => {
      const vct = await storeSdJwtVc()
      const definition: DifPresentationExchangeDefinitionV2 = {
        id: randomUUID(),
        input_descriptors: [
          {
            id: 'credential',
            format: {
              'vc+sd-jwt': { 'sd-jwt_alg_values': ['ES256'] },
              'dc+sd-jwt': { 'sd-jwt_alg_values': ['EdDSA'] },
            },
            constraints: { fields: [{ path: ['$.vct'], filter: { type: 'string', const: vct } }] },
          },
        ],
      }

      const { presentationSubmission, verifiablePresentations } = await present(definition)

      expect(presentationSubmission.descriptor_map).toStrictEqual([
        { id: 'credential', format: 'dc+sd-jwt', path: '$' },
      ])
      expect(() =>
        pexService.validatePresentation(definition, verifiablePresentations, presentationSubmission)
      ).not.toThrow()
    })

    test('presents a JWT VC under the designation whose restrictions it satisfies', async () => {
      const type = await storeJwtVc()
      const definition: DifPresentationExchangeDefinitionV2 = {
        id: randomUUID(),
        input_descriptors: [
          {
            id: 'credential',
            format: { jwt_vc: { alg: ['ES256'] }, jwt_vc_json: { alg: ['EdDSA'] } },
            constraints: { fields: [{ path: ['$.vc.type[*]'], filter: { type: 'string', const: type } }] },
          },
        ],
      }

      const { presentationSubmission, verifiablePresentations } = await present(definition)

      expect(presentationSubmission.descriptor_map).toStrictEqual([
        {
          id: 'credential',
          format: 'jwt_vp_json',
          path: '$',
          path_nested: { id: 'credential', format: 'jwt_vc_json', path: '$.vp.verifiableCredential[0]' },
        },
      ])
      expect(() =>
        pexService.validatePresentation(definition, verifiablePresentations, presentationSubmission)
      ).not.toThrow()
    })

    test('presents a JWT VC under the designation the format names through its presentation format', async () => {
      const type = await storeJwtVc()
      const { presentationSubmission } = await present({
        id: randomUUID(),
        format: { jwt_vp_json: { alg: ['EdDSA'] } },
        input_descriptors: [
          {
            id: 'credential',
            constraints: { fields: [{ path: ['$.vc.type[*]'], filter: { type: 'string', const: type } }] },
          },
        ],
      })

      expect(presentationSubmission.descriptor_map).toStrictEqual([
        {
          id: 'credential',
          format: 'jwt_vp_json',
          path: '$',
          path_nested: { id: 'credential', format: 'jwt_vc_json', path: '$.vp.verifiableCredential[0]' },
        },
      ])
    })

    test('presents under the most preferred designation when both are satisfied', async () => {
      const vct = await storeSdJwtVc()
      const { presentationSubmission } = await present({
        id: randomUUID(),
        input_descriptors: [
          { id: 'credential', constraints: { fields: [{ path: ['$.vct'], filter: { type: 'string', const: vct } }] } },
        ],
      })

      expect(presentationSubmission.descriptor_map[0].format).toBe('vc+sd-jwt')
    })
  })

  describe('verifier', () => {
    test('evaluates each descriptor under the designation it names, also for the same credential', async () => {
      const vct = await storeSdJwtVc()
      const fields = [{ path: ['$.vct'], filter: { type: 'string' as const, const: vct } }]
      const { verifiablePresentations } = await present({
        id: randomUUID(),
        input_descriptors: [{ id: 'credential', constraints: { fields } }],
      })

      const definition: DifPresentationExchangeDefinitionV2 = {
        id: randomUUID(),
        input_descriptors: [
          { id: 'old', format: { 'vc+sd-jwt': { 'sd-jwt_alg_values': ['EdDSA'] } }, constraints: { fields } },
          { id: 'new', format: { 'dc+sd-jwt': { 'sd-jwt_alg_values': ['EdDSA'] } }, constraints: { fields } },
        ],
      }
      const submission: DifPresentationExchangeSubmission = {
        id: randomUUID(),
        definition_id: definition.id,
        descriptor_map: [
          { id: 'old', format: 'vc+sd-jwt', path: '$' },
          { id: 'new', format: 'dc+sd-jwt', path: '$' },
        ],
      }

      expect(() => pexService.validatePresentation(definition, verifiablePresentations, submission)).not.toThrow()

      // A descriptor naming a designation its input descriptor doesn't allow is not satisfied
      const errors = getValidationErrors(() =>
        pexService.validatePresentation(definition, verifiablePresentations, {
          ...submission,
          descriptor_map: [
            { id: 'old', format: 'dc+sd-jwt', path: '$' },
            { id: 'new', format: 'dc+sd-jwt', path: '$' },
          ],
        })
      )
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatch(/^Descriptor 0 \('old'\): format/)
    })

    test('only trusts the proof type of a presented LDP credential with one proof', async () => {
      const type = await storeW3cVc(ClaimFormat.LdpVc)
      const definition = (proofType?: string): DifPresentationExchangeDefinitionV2 => ({
        id: 'ldp-definition',
        ...(proofType && { format: { ldp_vc: { proof_type: [proofType] } } }),
        input_descriptors: [
          {
            id: 'credential',
            constraints: { fields: [{ path: ['$.type[*]'], filter: { type: 'string', const: type } }] },
          },
        ],
      })
      const { verifiablePresentations, presentationSubmission } = await present(definition())
      const presentation = verifiablePresentations[0] as W3cJsonLdVerifiablePresentation

      expect(() =>
        pexService.validatePresentation(definition('Ed25519Signature2018'), presentation, presentationSubmission)
      ).not.toThrow()

      // A second proof with another type, which doesn't verify, as verifying only needs one proof to verify
      const json = presentation.toJSON()
      const [credential] = json.verifiableCredential as unknown as Array<{ proof: { type: string } }>
      credential.proof = [credential.proof, { ...credential.proof, type: 'Ed25519Signature2020' }] as never
      const withTwoProofs = JsonTransformer.fromJSON(json, W3cJsonLdVerifiablePresentation)

      for (const proofType of ['Ed25519Signature2018', 'Ed25519Signature2020']) {
        expect(
          getValidationErrors(() =>
            pexService.validatePresentation(definition(proofType), withTwoProofs, presentationSubmission)
          )
        ).toStrictEqual([expect.stringMatching(/^Descriptor 0 \('credential'\): format/)])
      }
    })

    test('reports a descriptor that points at no credential, with its index in the submission', async () => {
      const vct = await storeSdJwtVc()
      const fields = [{ path: ['$.vct'], filter: { type: 'string' as const, const: vct } }]
      const definition: DifPresentationExchangeDefinitionV2 = {
        id: randomUUID(),
        input_descriptors: [{ id: 'credential', constraints: { fields } }],
      }
      const { verifiablePresentations, presentationSubmission } = await present(definition)

      const errors = getValidationErrors(() =>
        pexService.validatePresentation(definition, verifiablePresentations, {
          ...presentationSubmission,
          descriptor_map: [
            ...presentationSubmission.descriptor_map,
            { id: 'credential', format: 'dc+sd-jwt', path: '$.verifiableCredential[3]' },
            { id: 'unknown', format: 'dc+sd-jwt', path: '$' },
          ],
        })
      )
      expect(errors).toStrictEqual([
        "Descriptor 1 ('credential'): Points at credential 3, which was not presented",
        "Descriptor 2 ('unknown') claims an input descriptor which the definition does not declare",
      ])
    })
  })
  describe('presentation signature', () => {
    // A definition with one input descriptor selecting the W3C credential with the type, and the formats
    const getDefinition = (
      type: string,
      format: DifPresentationExchangeDefinitionV2['format'],
      path = '$.vc.type[*]'
    ): DifPresentationExchangeDefinitionV2 => ({
      id: randomUUID(),
      format,
      input_descriptors: [
        { id: 'credential', constraints: { fields: [{ path: [path], filter: { type: 'string', const: type } }] } },
      ],
    })

    const getJwtVpAlgorithm = async (definition: DifPresentationExchangeDefinitionV2) => {
      const { verifiablePresentations } = await present(definition)
      return (verifiablePresentations[0] as W3cJwtVerifiablePresentation).jwt.header.alg
    }

    test('signs a JWT VP with an algorithm the jwt_vp format requires', async () => {
      const type = await storeJwtVc()

      expect(
        await getJwtVpAlgorithm(getDefinition(type, { jwt_vc: { alg: ['EdDSA'] }, jwt_vp: { alg: ['Ed25519'] } }))
      ).toBe('Ed25519')
    })

    test('throws when the key supports no algorithm the jwt_vp format requires', async () => {
      const type = await storeJwtVc()

      await expect(getJwtVpAlgorithm(getDefinition(type, { jwt_vp: { alg: ['ES256'] } }))).rejects.toThrow(
        'Found no suitable signing algorithm'
      )
    })

    test('prefers the first algorithm the jwt_vc format allows that the key supports', async () => {
      const type = await storeJwtVc()

      expect(await getJwtVpAlgorithm(getDefinition(type, { jwt_vc: { alg: ['ES256', 'Ed25519', 'EdDSA'] } }))).toBe(
        'Ed25519'
      )
    })

    test('uses the default algorithm of the key when it supports none the jwt_vc format allows', async () => {
      // The credential is signed with EdDSA, while the holder key is a P-256 key
      const type = await storeJwtVc(p256HolderDid)

      expect(await getJwtVpAlgorithm(getDefinition(type, { jwt_vc: { alg: ['EdDSA'] } }))).toBe('ES256')
    })

    test('uses the jwt_vp_json format for credentials presented as jwt_vc_json', async () => {
      const type = await storeJwtVc()
      const definition = getDefinition(type, {
        jwt_vc_json: { alg: ['EdDSA'] },
        jwt_vp_json: { alg: ['Ed25519'] },
      })

      expect(await getJwtVpAlgorithm(definition)).toBe('Ed25519')
    })

    test('signs an LDP VP with a proof type the ldp_vp format requires, or else one the ldp_vc format allows that the verification method can sign with', async () => {
      const type = await storeW3cVc(ClaimFormat.LdpVc)
      const getProofType = async (format: DifPresentationExchangeDefinitionV2['format']) => {
        const { verifiablePresentations } = await present(getDefinition(type, format, '$.type[*]'))
        const { proof } = verifiablePresentations[0] as W3cJsonLdVerifiablePresentation
        return (Array.isArray(proof) ? proof[0] : proof).type
      }

      // The holder's did:key has an Ed25519VerificationKey2018, which the Ed25519Signature2020 suite can't sign with
      expect(await getProofType({ ldp_vc: { proof_type: ['Ed25519Signature2020', 'Ed25519Signature2018'] } })).toBe(
        'Ed25519Signature2018'
      )
      expect(
        await getProofType({
          ldp_vc: { proof_type: ['Ed25519Signature2018'] },
          ldp_vp: { proof_type: ['Ed25519Signature2018'] },
        })
      ).toBe('Ed25519Signature2018')
      await expect(
        getProofType({
          ldp_vc: { proof_type: ['Ed25519Signature2018'] },
          ldp_vp: { proof_type: ['Ed25519Signature2020'] },
        })
      ).rejects.toThrow('No possible signature suite found for the given verification method')
    })
  })
})
