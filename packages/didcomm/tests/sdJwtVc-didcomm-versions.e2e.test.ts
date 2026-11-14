import type {
  ClaimPath,
  JsonObject,
  PeerDidNumAlgo2CreateOptions,
  SdJwtVcPayload,
  SdJwtVcTypeMetadata,
} from '@credo-ts/core'
import {
  Agent,
  DidDocumentBuilder,
  getEd25519VerificationKey2018,
  JsonEncoder,
  Kms,
  PeerDidNumAlgo,
  SdJwtVcModule,
  TypedArrayEncoder,
} from '@credo-ts/core'
import type { CreateDidKidVerificationMethodReturn, EventReplaySubject } from '../../core/tests'
import {
  createDidKidVerificationMethod,
  getAgentOptions,
  makeConnection,
  setupEventReplaySubjects,
  setupSubjectTransports,
  waitForCredentialRecordSubject,
} from '../../core/tests'
import {
  DidCommAttachment,
  DidCommAttachmentData,
  DidCommAutoAcceptCredential,
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Protocol,
  DidCommModule,
  DidCommSdJwtVcCredentialFormatService,
  DidCommV2EnvelopeService,
} from '../src'

const typeMetadata = {
  vct: 'https://credentials.example.com/typed_credential',
  claims: [
    { path: ['given_name'], sd: 'always' },
    { path: ['nationalities', null], sd: 'always' },
    { path: ['family_name'], sd: 'never' },
  ],
} satisfies SdJwtVcTypeMetadata

const disclosableIssuerTypeMetadata = {
  vct: 'https://credentials.example.com/disclosable_issuer',
  claims: [{ path: ['iss'], sd: 'always' }],
} satisfies SdJwtVcTypeMetadata

const getModules = (endpoint: string) =>
  ({
    sdJwtVc: new SdJwtVcModule({
      customTypeMetadataResolver: async (vct) =>
        [typeMetadata, disclosableIssuerTypeMetadata].find((metadata) => metadata.vct === vct),
    }),
    didcomm: new DidCommModule({
      endpoints: [endpoint],
      didcommVersions: ['v1', 'v2'],
      connections: { autoAcceptConnections: true },
      credentials: {
        credentialProtocols: [
          new DidCommCredentialV2Protocol({ credentialFormats: [new DidCommSdJwtVcCredentialFormatService()] }),
        ],
      },
    }),
  }) as const

type SdJwtVcAgent = Agent<ReturnType<typeof getModules>>

const formatAttachment = (format: string) => ({
  id: expect.any(String),
  media_type: 'application/json',
  format,
  data: { base64: expect.any(String) },
})

describe.each(['v1', 'v2'] as const)('dc+sd-jwt issuance over a DIDComm %s connection', (didCommVersion) => {
  let issuerAgent: SdJwtVcAgent
  let holderAgent: SdJwtVcAgent
  let issuerReplay: EventReplaySubject
  let holderReplay: EventReplaySubject
  let issuerConnectionId: string
  let issuerKdv: CreateDidKidVerificationMethodReturn
  let holderKdv: CreateDidKidVerificationMethodReturn

  beforeAll(async () => {
    issuerAgent = new Agent(
      getAgentOptions(`SdJwtVc issuer ${didCommVersion}`, {}, {}, getModules(`rxjs:sdjwtvc-issuer-${didCommVersion}`), {
        requireDidcomm: true,
      })
    )
    holderAgent = new Agent(
      getAgentOptions(`SdJwtVc holder ${didCommVersion}`, {}, {}, getModules(`rxjs:sdjwtvc-holder-${didCommVersion}`), {
        requireDidcomm: true,
      })
    )

    setupSubjectTransports([issuerAgent, holderAgent])
    await issuerAgent.initialize()
    await holderAgent.initialize()
    ;[issuerReplay, holderReplay] = setupEventReplaySubjects(
      [issuerAgent, holderAgent],
      [DidCommCredentialEventTypes.DidCommCredentialStateChanged]
    )

    const [issuerConnection, holderConnection] = await makeConnection(issuerAgent, holderAgent, { didCommVersion })
    expect(issuerConnection.didcommVersion ?? 'v1').toBe(didCommVersion)
    expect(holderConnection.didcommVersion ?? 'v1').toBe(didCommVersion)
    issuerConnectionId = issuerConnection.id

    issuerKdv = await createDidKidVerificationMethod(issuerAgent.context)
    holderKdv = await createDidKidVerificationMethod(holderAgent.context)
  })

  afterAll(async () => {
    await issuerAgent?.shutdown()
    await holderAgent?.shutdown()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each(['kid', 'jwk'] as const)('offer, request with a %s binding, issue and ack', async (binding) => {
    const unpackSpy = vi.spyOn(DidCommV2EnvelopeService.prototype, 'unpack')
    const credential = {
      vct: 'https://credentials.example.com/identity_credential',
      iss: issuerKdv.did,
      given_name: 'Erika',
      family_name: 'Mustermann',
    }

    const { threadId } = await issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        sdJwtVc: {
          credential,
          bindingRequired: true,
          didCommSignedAttachmentBinding: {
            algsSupported: ['EdDSA'],
            didMethodsSupported: ['key'],
            jwkSupported: binding === 'jwk',
          },
        },
      },
    })

    const holderOfferRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOfferRecord.id,
      credentialFormats: {
        sdJwtVc: {
          didCommSignedAttachment: binding === 'kid' ? { kid: holderKdv.kid } : { jwk: holderKdv.publicJwk },
        },
      },
    })

    const issuerRequestRecord = await waitForCredentialRecordSubject(issuerReplay, {
      threadId,
      state: DidCommCredentialState.RequestReceived,
    })
    await issuerAgent.didcomm.credentials.acceptRequest({ credentialExchangeRecordId: issuerRequestRecord.id })

    const holderCredentialRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.CredentialReceived,
    })
    await holderAgent.didcomm.credentials.acceptCredential({ credentialExchangeRecordId: holderCredentialRecord.id })
    await waitForCredentialRecordSubject(issuerReplay, { threadId, state: DidCommCredentialState.Done })

    const holderDoneRecord = await holderAgent.didcomm.credentials.getById(holderCredentialRecord.id)
    expect(holderDoneRecord.state).toBe(DidCommCredentialState.Done)
    expect(holderDoneRecord.credentials).toEqual([
      { credentialRecordType: 'sd-jwt-vc', credentialRecordId: expect.any(String) },
    ])

    const { prettyClaims, kmsKeyId } = (
      await holderAgent.sdJwtVc.getById(holderDoneRecord.credentials[0].credentialRecordId)
    ).firstCredential
    expect(prettyClaims).toEqual({
      ...credential,
      iat: expect.any(Number),
      cnf: binding === 'kid' ? { kid: holderKdv.kid } : { jwk: holderKdv.publicJwk.toJson({ includeKid: false }) },
    })
    expect(kmsKeyId).toBe(binding === 'jwk' ? holderKdv.publicJwk.keyId : undefined)

    const requestMessage = await holderAgent.didcomm.credentials.findRequestMessage(holderDoneRecord.id)
    expect(requestMessage?.appendedAttachments?.[0].data.base64).toMatch(/^[A-Za-z0-9_-]+$/)

    const plaintexts = unpackSpy.mock.settledResults
      .flatMap((result) => (result.type === 'fulfilled' ? [result.value.plaintext] : []))
      .filter(({ type }) => type.startsWith('https://didcomm.org/issue-credential/2.0/'))

    if (didCommVersion === 'v1') {
      expect(plaintexts).toEqual([])
      return
    }

    expect(plaintexts.map(({ type }) => type)).toEqual([
      'https://didcomm.org/issue-credential/2.0/offer-credential',
      'https://didcomm.org/issue-credential/2.0/request-credential',
      'https://didcomm.org/issue-credential/2.0/issue-credential',
      'https://didcomm.org/issue-credential/2.0/ack',
    ])

    const [offer, request, issue] = plaintexts
    for (const { body } of [offer, request, issue]) {
      expect(Object.keys(body ?? {}).filter((key) => key === 'formats' || key.endsWith('~attach'))).toEqual([])
    }
    expect(offer.attachments).toEqual([formatAttachment('didcomm/dc-sd-jwt-offer@v1.0')])
    expect(issue.attachments).toEqual([formatAttachment('didcomm/dc-sd-jwt@v1.0')])

    const { binding_proof } = JsonEncoder.fromBase64(request.attachments?.[0].data.base64 as string)
    expect(request.attachments).toEqual([
      formatAttachment('didcomm/dc-sd-jwt-request@v1.0'),
      {
        id: binding_proof?.didcomm_signed_attachment.attachment_id,
        media_type: 'application/json',
        data: {
          base64: expect.any(String),
          jws: expect.objectContaining({ protected: expect.any(String), signature: expect.any(String) }),
        },
      },
    ])
  })

  test('issues a credential bound to a DID key that is only in authentication', async () => {
    const kid = await createAuthenticationOnlyPeerDid(holderAgent)

    const { prettyClaims } = await issue({ credential: { ...identityCredential(), iss: issuerKdv.did }, kid })

    expect(prettyClaims.cnf).toEqual({ kid })
  })

  test('accepts a binding proof with padded base64 data, as older writers send it', async () => {
    const acceptRequest = DidCommSdJwtVcCredentialFormatService.prototype.acceptRequest
    const acceptRequestSpy = vi
      .spyOn(DidCommSdJwtVcCredentialFormatService.prototype, 'acceptRequest')
      .mockImplementation(function (this: DidCommSdJwtVcCredentialFormatService, agentContext, options) {
        for (const attachment of options.requestAppendAttachments ?? []) {
          attachment.data.base64 = TypedArrayEncoder.toBase64(attachment.getDataAsUint8Array())
        }
        return acceptRequest.call(this, agentContext, options)
      })

    const { prettyClaims } = await issue({ credential: { ...identityCredential(), iss: issuerKdv.did } })

    expect(acceptRequestSpy.mock.calls[0][1].requestAppendAttachments?.[0].data.base64).toMatch(/=$/)
    expect(prettyClaims.cnf).toEqual({ kid: holderKdv.kid })
  })

  test('sends issuance-abandoned when the binding proof has a wrong nonce', async () => {
    const acceptOffer = DidCommSdJwtVcCredentialFormatService.prototype.acceptOffer
    vi.spyOn(DidCommSdJwtVcCredentialFormatService.prototype, 'acceptOffer').mockImplementation(function (
      this: DidCommSdJwtVcCredentialFormatService,
      agentContext,
      options
    ) {
      const offer = options.offerAttachment.getDataAsJson<{
        binding_method: { didcomm_signed_attachment: JsonObject }
      }>()
      offer.binding_method.didcomm_signed_attachment = {
        ...offer.binding_method.didcomm_signed_attachment,
        nonce: 'another-nonce',
      }
      const offerAttachment = new DidCommAttachment({
        id: options.offerAttachment.id,
        data: new DidCommAttachmentData({ json: offer }),
      })
      return acceptOffer.call(this, agentContext, { ...options, offerAttachment })
    })

    const { threadId } = await issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        sdJwtVc: {
          credential: { ...identityCredential(), iss: issuerKdv.did },
          bindingRequired: true,
          didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'] },
        },
      },
    })

    const holderOfferRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOfferRecord.id,
      credentialFormats: { sdJwtVc: { didCommSignedAttachment: { kid: holderKdv.kid } } },
    })

    const holderAbandonedRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.Abandoned,
    })
    expect(holderAbandonedRecord.errorMessage).toBe('issuance-abandoned: Invalid nonce in signed attachment')

    const [issuerRecord] = await issuerAgent.didcomm.credentials.findAllByQuery({ threadId })
    expect(issuerRecord.state).toBe(DidCommCredentialState.OfferSent)
  })

  test('fills the offered status placeholder when the issuer accepts the request', async () => {
    const status = { status_list: { idx: 412, uri: 'https://issuer.example.com/statuslists/1' } }
    const credential = {
      ...identityCredential(),
      iss: issuerKdv.did,
      status: { status_list: {} },
    } as unknown as SdJwtVcPayload

    const { prettyClaims } = await issue({ credential, status })

    expect(prettyClaims).toEqual({ ...credential, status, iat: expect.any(Number), cnf: { kid: holderKdv.kid } })
  })

  test('waits for the issuer to fill a status placeholder even when it auto-accepts the request', async () => {
    const status = { status_list: { idx: 7, uri: 'https://issuer.example.com/statuslists/1' } }
    const credential = {
      ...identityCredential(),
      iss: issuerKdv.did,
      status: { status_list: {} },
    } as unknown as SdJwtVcPayload

    const shouldAutoRespondToRequest = vi.spyOn(
      DidCommSdJwtVcCredentialFormatService.prototype,
      'shouldAutoRespondToRequest'
    )

    const { prettyClaims } = await issue({
      credential,
      status,
      autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
    })

    await expect(shouldAutoRespondToRequest.mock.results[0]?.value).resolves.toBe(false)
    expect(prettyClaims).toEqual({ ...credential, status, iat: expect.any(Number), cnf: { kid: holderKdv.kid } })
  })

  test('does not issue while an offered status mechanism still has its members left out', async () => {
    const credential = {
      ...identityCredential(),
      iss: issuerKdv.did,
      status: { other_mechanism: {} },
    } as unknown as SdJwtVcPayload

    await expect(issue({ credential })).rejects.toThrow(
      "The issued 'status.other_mechanism' must have the members the offer left out"
    )
  })

  test('makes the claims the vct Type Metadata marks sd always selectively disclosable', async () => {
    const credential = typedCredential(issuerKdv.did)

    const { payload, prettyClaims } = await issue({ credential })

    expect(prettyClaims).toEqual({ ...credential, iat: expect.any(Number), cnf: { kid: holderKdv.kid } })
    expect(payload).not.toHaveProperty('given_name')
    expect(payload.nationalities).toEqual([{ '...': expect.any(String) }, { '...': expect.any(String) }])
    expect(payload.family_name).toBe('Mustermann')
  })

  test('does not offer a pointer to a claim the vct Type Metadata marks sd never', async () => {
    const offerCredential = issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        sdJwtVc: { credential: typedCredential(issuerKdv.did), selectivelyDisclosableClaims: [['family_name']] },
      },
    })

    await expect(offerCredential).rejects.toThrow(
      `Claim ["family_name"] is marked sd 'never' in the Type Metadata of 'vct'`
    )
  })

  test('does not offer a credential whose vct Type Metadata marks a protected claim sd always', async () => {
    const offerCredential = issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        sdJwtVc: { credential: { vct: disclosableIssuerTypeMetadata.vct, iss: issuerKdv.did } },
      },
    })

    await expect(offerCredential).rejects.toThrow('Claim ["iss"] cannot be selectively disclosable')
  })

  async function issue({
    credential,
    selectivelyDisclosableClaims,
    kid = holderKdv.kid,
    status,
    autoAcceptCredential,
  }: {
    credential: SdJwtVcPayload
    selectivelyDisclosableClaims?: ClaimPath[]
    kid?: string
    status?: SdJwtVcPayload['status']
    autoAcceptCredential?: DidCommAutoAcceptCredential
  }) {
    const { threadId } = await issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerConnectionId,
      protocolVersion: 'v2',
      autoAcceptCredential,
      credentialFormats: {
        sdJwtVc: {
          credential,
          selectivelyDisclosableClaims,
          bindingRequired: true,
          didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key', 'peer'] },
        },
      },
    })

    const holderOfferRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOfferRecord.id,
      credentialFormats: { sdJwtVc: { didCommSignedAttachment: { kid } } },
    })

    const issuerRequestRecord = await waitForCredentialRecordSubject(issuerReplay, {
      threadId,
      state: DidCommCredentialState.RequestReceived,
    })
    await issuerAgent.didcomm.credentials.acceptRequest({
      credentialExchangeRecordId: issuerRequestRecord.id,
      credentialFormats: { sdJwtVc: { status } },
    })

    const holderCredentialRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.CredentialReceived,
    })
    await holderAgent.didcomm.credentials.acceptCredential({ credentialExchangeRecordId: holderCredentialRecord.id })
    await waitForCredentialRecordSubject(issuerReplay, { threadId, state: DidCommCredentialState.Done })

    const [{ credentialRecordId }] = (await holderAgent.didcomm.credentials.getById(holderCredentialRecord.id))
      .credentials
    return (await holderAgent.sdJwtVc.getById(credentialRecordId)).firstCredential
  }
})

const identityCredential = () => ({
  vct: 'https://credentials.example.com/identity_credential',
  given_name: 'Erika',
  family_name: 'Mustermann',
})

const typedCredential = (iss: string) => ({
  vct: typeMetadata.vct,
  iss,
  given_name: 'Erika',
  family_name: 'Mustermann',
  nationalities: ['DE', 'FR'],
})

async function createAuthenticationOnlyPeerDid(agent: SdJwtVcAgent): Promise<string> {
  const { keyId, publicJwk } = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
  const verificationMethod = getEd25519VerificationKey2018({
    id: '#key-1',
    controller: '#id',
    publicJwk: Kms.PublicJwk.fromPublicJwk(publicJwk),
  })

  const { didState } = await agent.dids.create<PeerDidNumAlgo2CreateOptions>({
    method: 'peer',
    didDocument: new DidDocumentBuilder('')
      .addVerificationMethod(verificationMethod)
      .addAuthentication(verificationMethod.id)
      .build(),
    options: {
      numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
      keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: keyId }],
    },
  })

  return `${didState.did}#key-1`
}
