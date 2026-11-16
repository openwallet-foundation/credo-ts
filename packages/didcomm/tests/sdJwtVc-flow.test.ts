import type {
  ClaimPath,
  DidRepository,
  IDisclosureFrame,
  JsonObject,
  JwsDetachedFormat,
  PeerDidNumAlgo2CreateOptions,
  SdJwtVcPayload,
  SdJwtVcSignOptions,
} from '@credo-ts/core'
import {
  AgentContext,
  CacheModuleConfig,
  DidDocumentBuilder,
  DidResolverService,
  DidsApi,
  DidsModuleConfig,
  getEd25519VerificationKey2018,
  InjectionSymbols,
  InMemoryLruCache,
  JsonEncoder,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
  PeerDidNumAlgo,
  SdJwtVcApi,
  SdJwtVcModule,
  X509ModuleConfig,
} from '@credo-ts/core'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import { simpleX509 } from '../../core/src/modules/sd-jwt-vc/__tests__/sdjwtvc.fixtures'
import type { CreateDidKidVerificationMethodReturn } from '../../core/tests'
import {
  agentDependencies,
  createDidKidVerificationMethod,
  getAgentConfig,
  getAgentContext,
  testLogger,
} from '../../core/tests'
import {
  DidCommAttachment,
  DidCommAttachmentData,
  DidCommCredentialExchangeRecord,
  DidCommCredentialFormatSpec,
  DidCommCredentialProblemReportReason,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommCredentialV2Preview,
  DidCommMessageRepository,
  DidCommMessageRole,
  DidCommOfferCredentialV2Message,
  DidCommSdJwtVcCredentialFormatService,
  V2CredentialProblemReportError,
} from '../src'
import { createDidCommSignedAttachment } from '../src/modules/credentials/util/didCommSignedAttachment'

const agentConfig = getAgentConfig('SdJwtVc format service test')
const inMemoryStorageService = new InMemoryStorageService()

const didsModuleConfig = new DidsModuleConfig({
  registrars: [new KeyDidRegistrar()],
  resolvers: [new KeyDidResolver()],
})

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.FileSystem, new agentDependencies.FileSystem()],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [InjectionSymbols.Logger, testLogger],
    [DidsModuleConfig, didsModuleConfig],
    [DidResolverService, new DidResolverService(testLogger, didsModuleConfig, {} as unknown as DidRepository)],
    [X509ModuleConfig, new X509ModuleConfig()],
    [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
  ],
  agentConfig,
})

agentContext.dependencyManager.registerInstance(AgentContext, agentContext)
agentContext.dependencyManager.registerModules({
  sdJwtVc: new SdJwtVcModule(),
})

const formatService = new DidCommSdJwtVcCredentialFormatService()
const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

const offeredCredential = {
  vct: 'https://credentials.example.com/identity_credential',
  given_name: 'Erika',
  family_name: 'Mustermann',
  address: { locality: 'Berlin', country: 'DE' },
  nationalities: ['DE'],
} satisfies SdJwtVcPayload

const selectivelyDisclosableClaims: ClaimPath[] = [['given_name'], ['address', 'locality'], ['nationalities', 0]]
const disclosureFrame: IDisclosureFrame = {
  _sd: ['given_name'],
  address: { _sd: ['locality'] },
  nationalities: { _sd: [0] },
}

const attachment = (json: unknown) =>
  new DidCommAttachment({
    id: 'attachment-id',
    mimeType: 'application/json',
    data: new DidCommAttachmentData({ json: json as JsonObject }),
  })

let issuerKdv: CreateDidKidVerificationMethodReturn
let holderKdv: CreateDidKidVerificationMethodReturn

describe('dc+sd-jwt credential format service', () => {
  beforeAll(async () => {
    issuerKdv = await createDidKidVerificationMethod(agentContext, '96213c3d7fc8d4d6754c7a0fd969598g')
    holderKdv = await createDidKidVerificationMethod(agentContext, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('issues a credential bound to the key of the binding proof', async () => {
    const {
      issuerCredentialRecord,
      holderCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    } = await offerAndRequest({ binding: 'kid' })

    expect(offerAttachment.getDataAsJson()).toMatchObject({
      binding_required: true,
      selectively_disclosable_claims: selectivelyDisclosableClaims,
      credential: offeredCredential,
    })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    await formatService.processCredential(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      attachment: credentialAttachment,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    expect(holderCredentialRecord.credentials).toEqual([
      { credentialRecordType: 'sd-jwt-vc', credentialRecordId: expect.any(String) },
    ])

    const record = await sdJwtVcApi.getById(holderCredentialRecord.credentials[0].credentialRecordId)
    const { header, payload, prettyClaims, kmsKeyId } = record.firstCredential

    expect(header.typ).toBe('dc+sd-jwt')
    expect(kmsKeyId).toBeUndefined()
    expect(prettyClaims).toEqual({
      ...offeredCredential,
      iss: issuerKdv.did,
      iat: expect.any(Number),
      cnf: { kid: holderKdv.kid },
    })
    expect(payload).not.toHaveProperty('given_name')
    expect(payload.address).toEqual({ country: 'DE', _sd: [expect.any(String)] })
    expect(payload.nationalities).toEqual([{ '...': expect.any(String) }])
  })

  test('issues a credential without binding', async () => {
    const {
      issuerCredentialRecord,
      holderCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    } = await offerAndRequest()

    expect(requestAttachment.getDataAsJson()).toEqual({})

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    await formatService.processCredential(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      attachment: credentialAttachment,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    const record = await sdJwtVcApi.getById(holderCredentialRecord.credentials[0].credentialRecordId)
    expect(record.firstCredential.prettyClaims).toEqual({
      ...offeredCredential,
      iss: issuerKdv.did,
      iat: expect.any(Number),
    })
    expect(record.firstCredential.kmsKeyId).toBeUndefined()
  })

  test('issues a credential bound to the jwk of the binding proof', async () => {
    const {
      issuerCredentialRecord,
      holderCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    } = await offerAndRequest({ binding: 'jwk' })

    expect(offerAttachment.getDataAsJson()).toMatchObject({
      binding_method: { didcomm_signed_attachment: { did_methods_supported: [], jwk_supported: true } },
    })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    await formatService.processCredential(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      attachment: credentialAttachment,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    const record = await sdJwtVcApi.getById(holderCredentialRecord.credentials[0].credentialRecordId)
    expect(record.firstCredential.prettyClaims.cnf).toEqual({ jwk: holderKdv.publicJwk.toJson({ includeKid: false }) })
    expect(record.firstCredential.kmsKeyId).toBe(holderKdv.publicJwk.keyId)
  })

  test('issues a credential bound to a DID key that is only in authentication', async () => {
    const { kid } = await createPeerDidKid('authentication')
    const {
      issuerCredentialRecord,
      holderCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    } = await offerAndRequest({ binding: 'kid', kid })

    const { attachment: credentialAttachment } = await formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    await formatService.processCredential(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      attachment: credentialAttachment,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    const record = await sdJwtVcApi.getById(holderCredentialRecord.credentials[0].credentialRecordId)
    expect(record.firstCredential.prettyClaims.cnf).toEqual({ kid })
  })

  test('rejects a binding key that is not in the authentication relationship', async () => {
    const { kid } = await createPeerDidKid('assertionMethod')
    const { issuerCredentialRecord, holderCredentialRecord, offerAttachment } = await offerAndRequest({
      binding: 'kid',
    })

    const acceptOffer = formatService.acceptOffer(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: { sdJwtVc: { didCommSignedAttachment: { kid } } },
    })
    await expect(acceptOffer).rejects.toThrow(`'${kid}' in purposes authentication`)

    const offer = offerAttachment.getDataAsJson<{ binding_method: { didcomm_signed_attachment: { nonce: string } } }>()
    const signedAttachment = await createDidCommSignedAttachment(
      agentContext,
      { nonce: offer.binding_method.didcomm_signed_attachment.nonce },
      { kid },
      ['EdDSA']
    )
    const acceptRequest = formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment: attachment({
        binding_proof: { didcomm_signed_attachment: { attachment_id: signedAttachment.id } },
      }),
      requestAppendAttachments: [signedAttachment],
    })
    await expect(acceptRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(acceptRequest).rejects.toThrow(`'${kid}' in purposes authentication`)
  })

  test('acceptOffer rejects a jwk binding proof when the offer does not set jwk_supported', async () => {
    const { holderCredentialRecord, offerAttachment } = await offerAndRequest({ binding: 'kid' })

    const acceptOffer = formatService.acceptOffer(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: { sdJwtVc: { didCommSignedAttachment: { jwk: holderKdv.publicJwk } } },
    })

    await expect(acceptOffer).rejects.toThrow("The offer does not accept a 'jwk' binding proof")
  })

  test.each<[string, { iss?: string }]>([
    ['no iss', {}],
    ['an https iss', { iss: 'https://issuer.example.com' }],
    ['a DID URL iss', { iss: 'did:example:issuer#key-1' }],
  ])('createOffer rejects an offer with %s', async (_, claims) => {
    const createOffer = formatService.createOffer(agentContext, {
      credentialExchangeRecord: new DidCommCredentialExchangeRecord({
        protocolVersion: 'v2',
        state: DidCommCredentialState.OfferSent,
        threadId: '3b2a1f0e-9d8c-4b7a-8f6e-5d4c3b2a1f0e',
        role: DidCommCredentialRole.Issuer,
      }),
      credentialFormats: { sdJwtVc: { credential: { ...offeredCredential, ...claims } } },
    })

    await expect(createOffer).rejects.toThrow("must have an 'iss' that is a DID without a path, query or fragment")
  })

  test.each<[string, JsonObject, string]>([
    ['no vct', { credential: { given_name: 'Erika' } }, "must have a string 'vct'"],
    [
      'a cnf claim',
      { credential: { ...offeredCredential, cnf: { kid: 'did:example:holder#key-1' } } },
      "must not have a 'cnf' claim",
    ],
    [
      'a nested _sd entry',
      { credential: { ...offeredCredential, address: { country: 'DE', _sd: [] } } },
      "must not have '_sd', '_sd_alg' or '...' entries",
    ],
    ['a pointer to a missing claim', { selectively_disclosable_claims: [['birthdate']] }, 'does not select a claim'],
    [
      'a pointer with null',
      { selectively_disclosable_claims: [['nationalities', null]] },
      'must be a non-empty array of strings and non-negative integers',
    ],
    [
      'a pointer into status',
      {
        credential: { ...offeredCredential, status: { status_list: {} } },
        selectively_disclosable_claims: [['status', 'status_list']],
      },
      'cannot be selectively disclosable',
    ],
    ['binding_required without binding_method', { binding_required: true }, 'the offer has no binding method'],
    [
      'an exp that is not a number',
      { credential: { ...offeredCredential, exp: '2030-01-01' } },
      "'exp' must be a number",
    ],
    [
      'an empty aka_vcts',
      { credential: { ...offeredCredential, aka_vcts: [] } },
      "'aka_vcts' must be a non-empty array",
    ],
    [
      'an aka_vcts with the vct',
      { credential: { ...offeredCredential, aka_vcts: [offeredCredential.vct] } },
      "that does not contain its 'vct'",
    ],
    ['an empty status', { credential: { ...offeredCredential, status: {} } }, 'at least one status mechanism'],
    [
      'an http status list',
      {
        credential: {
          ...offeredCredential,
          status: { status_list: { idx: 0, uri: 'http://example.com/statuslists/1' } },
        },
      },
      "'status.status_list.uri' must be an https URI",
    ],
  ])('processOffer rejects an offer with %s', async (_, offer, error) => {
    const processOffer = formatService.processOffer(agentContext, {
      credentialExchangeRecord: new DidCommCredentialExchangeRecord({
        protocolVersion: 'v2',
        state: DidCommCredentialState.OfferReceived,
        threadId: '2c1f0f5e-7f6b-4a8e-9d3c-5b4a3f2e1d0c',
        role: DidCommCredentialRole.Holder,
      }),
      attachment: attachment({ credential: offeredCredential, ...offer }),
    })

    await expect(processOffer).rejects.toThrow(V2CredentialProblemReportError)
    await expect(processOffer).rejects.toThrow(error)
    await expect(processOffer).rejects.toMatchObject({
      problemReport: { description: { code: DidCommCredentialProblemReportReason.IssuanceAbandoned } },
    })
  })

  test('processCredential rejects a credential with a key binding JWT', async () => {
    await processTamperedCredential({
      tamper: (compact) => `${compact}eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.e30.c2lnbmF0dXJl`,
      error: 'without a Key Binding JWT',
    })
  })

  test('processCredential rejects a credential with an invalid signature', async () => {
    await processTamperedCredential({
      tamper: (compact) => {
        const [jwt, ...disclosures] = compact.split('~')
        const [header, payload, signature] = jwt.split('.')
        const changedPayload = JsonEncoder.toBase64Url({ ...JsonEncoder.fromBase64Url(payload), iat: 0 })
        return [`${header}.${changedPayload}.${signature}`, ...disclosures].join('~')
      },
      error: 'Failed to verify the SD-JWT VC',
    })
  })

  test('processCredential rejects a credential with typ vc+sd-jwt', async () => {
    await processTamperedCredential({
      sign: { headerType: 'vc+sd-jwt' },
      error: "header 'typ' must be 'dc+sd-jwt'",
    })
  })

  test('processCredential rejects a credential with a DID iss and an x5c header', async () => {
    await processTamperedCredential({
      tamper: (compact) => {
        const [header, ...rest] = compact.split('.')
        const x5cHeader = JsonEncoder.toBase64Url({
          ...JsonEncoder.fromBase64Url(header),
          x5c: [simpleX509.trustedCertificate],
        })
        return [x5cHeader, ...rest].join('.')
      },
      error: "with a DID 'iss' must not have an 'x5c' header",
    })
  })

  test('processCredential rejects a credential that makes aka_vcts selectively disclosable', async () => {
    await processTamperedCredential({
      sign: {
        payload: { ...offeredCredential, aka_vcts: ['https://credentials.example.com/previous_identity_credential'] },
        disclosureFrame: { ...disclosureFrame, _sd: ['given_name', 'aka_vcts'] },
      },
      error: "Claim 'aka_vcts' must not be selectively disclosable",
    })
  })

  test('processCredential rejects a credential with a claim that was not offered', async () => {
    await processTamperedCredential({
      sign: { payload: { ...offeredCredential, birthdate: '1963-08-12' } },
      error: 'do not match the offered credential',
    })
  })

  test('processCredential rejects a credential that makes only the parent of an offered claim disclosable', async () => {
    await processTamperedCredential({
      sign: { disclosureFrame: { _sd: ['given_name', 'address'], nationalities: { _sd: [0] } } },
      error: 'Claim ["address","locality"] was offered as selectively disclosable, but is not',
    })
  })

  test('processCredential rejects a credential bound to another key', async () => {
    await processTamperedCredential({
      binding: 'jwk',
      sign: { holder: { method: 'jwk', jwk: issuerKdv.publicJwk } },
      error: "'cnf.jwk' is not the key of the binding proof",
    })
  })

  test('processCredential rejects cnf.jwk for a binding proof with kid', async () => {
    await processTamperedCredential({
      binding: 'kid',
      sign: { holder: { method: 'jwk', jwk: holderKdv.publicJwk } },
      error: "'cnf.kid' is not the key of the binding proof",
    })
  })

  test('processCredential rejects a bound credential when the request had no binding proof', async () => {
    await processTamperedCredential({
      sign: { holder: { method: 'jwk', jwk: holderKdv.publicJwk } },
      error: "has a 'cnf' claim, but the request has no binding proof",
    })
  })

  test('processCredential rejects a credential with an http status list', async () => {
    await processTamperedCredential({
      sign: {
        payload: {
          ...offeredCredential,
          status: { status_list: { idx: 0, uri: 'http://example.com/statuslists/1' } },
        },
      },
      error: "'status.status_list.uri' must be an https URI",
    })
  })

  test.each<[string, DidCommCredentialState, string | undefined]>([
    ['does not answer an offer', DidCommCredentialState.RequestReceived, undefined],
    ['answers an offer in another format', DidCommCredentialState.OfferSent, 'aries/ld-proof-vc-detail@v1.0'],
  ])('processRequest rejects a request that %s', async (_, state, offerFormat) => {
    const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      state,
      threadId: '6e5d4c3b-2a19-4f8e-8d7c-6b5a4f3e2d1c',
      role: DidCommCredentialRole.Issuer,
    })
    if (offerFormat) {
      await saveSentOffer(
        credentialExchangeRecord,
        new DidCommCredentialFormatSpec({ attachmentId: 'attachment-id', format: offerFormat }),
        attachment({})
      )
    }

    const processRequest = formatService.processRequest(agentContext, {
      credentialExchangeRecord,
      attachment: attachment({}),
    })

    await expect(processRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(processRequest).rejects.toMatchObject({
      problemReport: { description: { code: DidCommCredentialProblemReportReason.IssuanceAbandoned } },
    })
  })

  test('processRequest rejects a request without a binding proof when the offer requires binding', async () => {
    const { issuerCredentialRecord } = await offerAndRequest({ binding: 'kid' })

    const processRequest = formatService.processRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      attachment: attachment({}),
    })

    await expect(processRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(processRequest).rejects.toThrow('Binding is required but no binding proof was provided')
  })

  test.each<[string, 'kid' | 'jwk', JsonObject, string]>([
    ['an alg', 'kid', { algs_supported: ['ES256'] }, "alg 'EdDSA' is not one of the supported algorithms ES256"],
    ['a nonce', 'kid', { nonce: 'another-nonce' }, 'Invalid nonce in signed attachment'],
    ['a DID method', 'kid', { did_methods_supported: ['jwk'] }, "DID method 'key' is not supported by the issuer"],
    ['a jwk', 'jwk', { jwk_supported: false }, "The offer does not accept a 'jwk' binding proof"],
    [
      'an alg on a jwk proof',
      'jwk',
      { algs_supported: ['ES256'] },
      "alg 'EdDSA' is not one of the supported algorithms ES256",
    ],
    ['a nonce on a jwk proof', 'jwk', { nonce: 'another-nonce' }, 'Invalid nonce in signed attachment'],
  ])('acceptRequest rejects a binding proof with %s that was not offered', async (_, binding, bindingMethod, error) => {
    const { issuerCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments } =
      await offerAndRequest({ binding })

    const offer = offerAttachment.getDataAsJson<{ binding_method: { didcomm_signed_attachment: JsonObject } }>()
    const acceptRequest = formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment: attachment({
        ...offer,
        binding_method: {
          didcomm_signed_attachment: { ...offer.binding_method.didcomm_signed_attachment, ...bindingMethod },
        },
      }),
      requestAttachment,
      requestAppendAttachments,
    })

    await expect(acceptRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(acceptRequest).rejects.toThrow(error)
  })

  test.each<[string, 'kid' | 'jwk', (jwk: JsonObject) => JsonObject, string]>([
    ['both kid and jwk', 'jwk', (jwk) => ({ kid: holderKdv.kid, jwk }), "must not have both 'kid' and 'jwk'"],
    [
      'both kid and jwk when the offer has no jwk_supported',
      'kid',
      () => ({ jwk: holderKdv.publicJwk.toJson({ includeKid: false }) }),
      "must not have both 'kid' and 'jwk'",
    ],
    ['an x5u', 'jwk', (jwk) => ({ jwk: { ...jwk, x5u: 'https://holder.example.com/key.pem' } }), "must not have 'x5u'"],
    ['private key material', 'jwk', (jwk) => ({ jwk: { ...jwk, d: 'private' } }), 'JWK contains private key material'],
  ])('acceptRequest rejects a jwk binding proof with %s', async (_, binding, header, error) => {
    const { issuerCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments } =
      await offerAndRequest({ binding })

    const jws = requestAppendAttachments?.[0].data.jws as JwsDetachedFormat
    const { jwk, ...protectedHeader } = JsonEncoder.fromBase64Url(jws.protected)
    jws.protected = JsonEncoder.toBase64Url({ ...protectedHeader, ...header(jwk) })

    const acceptRequest = formatService.acceptRequest(agentContext, {
      credentialExchangeRecord: issuerCredentialRecord,
      offerAttachment,
      requestAttachment,
      requestAppendAttachments,
    })

    await expect(acceptRequest).rejects.toThrow(V2CredentialProblemReportError)
    await expect(acceptRequest).rejects.toThrow(error)
  })

  test('logs once that the format is experimental', async () => {
    const service = new DidCommSdJwtVcCredentialFormatService()
    const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')
    const processOffer = () =>
      service.processOffer(agentContext, {
        credentialExchangeRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          state: DidCommCredentialState.OfferReceived,
          threadId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
          role: DidCommCredentialRole.Holder,
        }),
        attachment: attachment({ credential: offeredCredential }),
      })

    await processOffer()
    await processOffer()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(
      "The dc+sd-jwt credential format of '@credo-ts/didcomm' is experimental and could have unexpected breaking changes. When using this format, make sure to use strict versions for all @credo-ts packages."
    )
  })
})

async function offerAndRequest({ binding, kid = holderKdv.kid }: { binding?: 'kid' | 'jwk'; kid?: string } = {}) {
  const threadId = 'f365c1a5-2baf-4873-9432-fa87c888a0aa'
  const issuerCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: 'v2',
    state: DidCommCredentialState.OfferSent,
    threadId,
    role: DidCommCredentialRole.Issuer,
  })
  const holderCredentialRecord = new DidCommCredentialExchangeRecord({
    protocolVersion: 'v2',
    state: DidCommCredentialState.OfferReceived,
    threadId,
    role: DidCommCredentialRole.Holder,
  })

  const { format: offerFormat, attachment: offerAttachment } = await formatService.createOffer(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    credentialFormats: {
      sdJwtVc: {
        credential: { ...offeredCredential, iss: issuerKdv.did },
        selectivelyDisclosableClaims,
        bindingRequired: binding !== undefined,
        didCommSignedAttachmentBinding:
          binding === 'jwk'
            ? { algsSupported: ['EdDSA'], didMethodsSupported: [], jwkSupported: true }
            : { algsSupported: ['EdDSA'], didMethodsSupported: ['key', 'peer'] },
      },
    },
  })
  await saveSentOffer(issuerCredentialRecord, offerFormat, offerAttachment)

  await formatService.processOffer(agentContext, {
    credentialExchangeRecord: holderCredentialRecord,
    attachment: offerAttachment,
  })

  const { attachment: requestAttachment, appendAttachments: requestAppendAttachments } =
    await formatService.acceptOffer(agentContext, {
      credentialExchangeRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: {
        sdJwtVc: binding ? { didCommSignedAttachment: binding === 'jwk' ? { jwk: holderKdv.publicJwk } : { kid } } : {},
      },
    })

  await formatService.processRequest(agentContext, {
    credentialExchangeRecord: issuerCredentialRecord,
    attachment: requestAttachment,
    requestAppendAttachments,
  })

  return {
    issuerCredentialRecord,
    holderCredentialRecord,
    offerAttachment,
    requestAttachment,
    requestAppendAttachments,
  }
}

async function saveSentOffer(
  credentialExchangeRecord: DidCommCredentialExchangeRecord,
  format: DidCommCredentialFormatSpec,
  offerAttachment: DidCommAttachment
) {
  await agentContext.dependencyManager.resolve(DidCommMessageRepository).saveAgentMessage(agentContext, {
    agentMessage: new DidCommOfferCredentialV2Message({
      formats: [format],
      offerAttachments: [offerAttachment],
      credentialPreview: new DidCommCredentialV2Preview({ attributes: [] }),
    }),
    role: DidCommMessageRole.Sender,
    associatedRecordId: credentialExchangeRecord.id,
  })
}

async function createPeerDidKid(purpose: 'authentication' | 'assertionMethod') {
  const { keyId, publicJwk } = await agentContext.dependencyManager
    .resolve(Kms.KeyManagementApi)
    .createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
  const verificationMethod = getEd25519VerificationKey2018({
    id: '#key-1',
    controller: '#id',
    publicJwk: Kms.PublicJwk.fromPublicJwk(publicJwk),
  })

  const didDocument = new DidDocumentBuilder('').addVerificationMethod(verificationMethod)
  if (purpose === 'authentication') didDocument.addAuthentication(verificationMethod.id)
  else didDocument.addAssertionMethod(verificationMethod.id)

  const { didState } = await agentContext.dependencyManager.resolve(DidsApi).create<PeerDidNumAlgo2CreateOptions>({
    method: 'peer',
    didDocument: didDocument.build(),
    options: {
      numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
      keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: keyId }],
    },
  })

  return { kid: `${didState.did}#key-1`, keyId }
}

async function processTamperedCredential({
  binding,
  sign = {},
  tamper = (compact) => compact,
  error,
}: {
  binding?: 'kid' | 'jwk'
  sign?: Partial<SdJwtVcSignOptions>
  tamper?: (compact: string) => string
  error: string
}) {
  const { holderCredentialRecord, offerAttachment, requestAttachment, requestAppendAttachments } =
    await offerAndRequest({ binding })

  const { compact } = await sdJwtVcApi.sign({
    payload: offeredCredential,
    issuer: { method: 'did', didUrl: issuerKdv.verificationMethod.id },
    disclosureFrame,
    ...sign,
  })

  const storedCredentials = (await sdJwtVcApi.getAll()).length
  const processCredential = formatService.processCredential(agentContext, {
    credentialExchangeRecord: holderCredentialRecord,
    attachment: attachment({ credential: tamper(compact) }),
    offerAttachment,
    requestAttachment,
    requestAppendAttachments,
  })

  await expect(processCredential).rejects.toThrow(V2CredentialProblemReportError)
  await expect(processCredential).rejects.toThrow(error)
  await expect(processCredential).rejects.toMatchObject({
    problemReport: { description: { code: DidCommCredentialProblemReportReason.IssuanceAbandoned } },
  })
  expect(await sdJwtVcApi.getAll()).toHaveLength(storedCredentials)
}
