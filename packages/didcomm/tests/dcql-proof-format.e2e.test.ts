import type { DcqlQuery, JsonObject, JwkDidCreateOptions, W3cV2SdJwtVerifiableCredential } from '@credo-ts/core'
import {
  Agent,
  ClaimFormat,
  DcqlService,
  DidKey,
  JsonEncoder,
  SdJwtVcModule,
  SdJwtVcRecord,
  W3cV2Credential,
  W3cV2CredentialRecord,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2Presentation,
  W3cV2SdJwtCredentialService,
} from '@credo-ts/core'
import type { CreateDidKidVerificationMethodReturn, EventReplaySubject } from '../../core/tests'
import {
  createDidKidVerificationMethod,
  getAgentOptions,
  makeConnection,
  setupEventReplaySubjects,
  setupSubjectTransports,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecordSubject,
} from '../../core/tests'
import type { DcqlPresentationAttachment, DcqlRequestAttachment, DidCommProofExchangeRecord } from '../src'
import {
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Protocol,
  DidCommDcqlProofFormatService,
  DidCommEnvelopeService,
  DidCommHandshakeProtocol,
  DidCommModule,
  DidCommProofEventTypes,
  DidCommProofState,
  DidCommProofV2Protocol,
  DidCommRoutingService,
  DidCommW3cV2SdJwtCredentialFormatService,
} from '../src'

const VCT = 'https://credentials.example.com/identity_credential'

const statusLists: Record<string, string> = {}
const statusListFetcher = vi.fn(async (uri: string) => statusLists[uri])

const getModules = (endpoint: string) =>
  ({
    sdJwtVc: new SdJwtVcModule({ customStatusListFetcher: statusListFetcher }),
    didcomm: new DidCommModule({
      endpoints: [endpoint],
      connections: { autoAcceptConnections: true },
      credentials: {
        credentialProtocols: [
          new DidCommCredentialV2Protocol({ credentialFormats: [new DidCommW3cV2SdJwtCredentialFormatService()] }),
        ],
      },
      proofs: {
        proofProtocols: [new DidCommProofV2Protocol({ proofFormats: [new DidCommDcqlProofFormatService()] })],
      },
    }),
  }) as const

type DcqlAgent = Agent<ReturnType<typeof getModules>>
type Plaintext = Record<string, unknown>

const unpacked: Plaintext[] = []

const originalUnpack = DidCommEnvelopeService.prototype.unpackMessage
vi.spyOn(DidCommEnvelopeService.prototype, 'unpackMessage').mockImplementation(async function (
  this: DidCommEnvelopeService,
  ...args: Parameters<DidCommEnvelopeService['unpackMessage']>
) {
  const result = await originalUnpack.apply(this, args)
  unpacked.push(structuredClone(result.plaintextMessage))
  return result
})

const findPlaintext = (threadId: string, typeSuffix: string): Plaintext => {
  const plaintext = unpacked.find((message) => {
    const thread = message['~thread'] as { thid?: string } | undefined
    return (message['@type'] as string).endsWith(typeSuffix) && (thread?.thid ?? message['@id']) === threadId
  })
  if (!plaintext) throw new Error(`No ${typeSuffix} message unpacked for thread ${threadId}`)
  return plaintext
}

const decodeJwt = (jwt: string): { header: unknown; payload: unknown } => {
  const [header, payload] = jwt.split('.')
  return { header: JsonEncoder.fromBase64Url(header), payload: JsonEncoder.fromBase64Url(payload) }
}

const decodeDisclosures = (disclosures: string[]): Array<[string, string, unknown]> =>
  disclosures.filter(Boolean).map((disclosure) => JsonEncoder.fromBase64Url(disclosure) as [string, string, unknown])

describe('DCQL proof format over a DIDComm connection', () => {
  let verifierAgent: DcqlAgent
  let holderAgent: DcqlAgent
  let verifierReplay: EventReplaySubject
  let holderReplay: EventReplaySubject
  let verifierConnectionId: string
  let verifierDid: string
  let issuerKdv: CreateDidKidVerificationMethodReturn
  let holderKdv: CreateDidKidVerificationMethodReturn
  let statusListUri: string

  beforeAll(async () => {
    verifierAgent = new Agent(
      getAgentOptions('DCQL verifier', {}, {}, getModules('rxjs:dcql-verifier'), { requireDidcomm: true })
    )
    holderAgent = new Agent(
      getAgentOptions('DCQL holder', {}, {}, getModules('rxjs:dcql-holder'), { requireDidcomm: true })
    )

    setupSubjectTransports([verifierAgent, holderAgent])
    await verifierAgent.initialize()
    await holderAgent.initialize()
    ;[verifierReplay, holderReplay] = setupEventReplaySubjects(
      [verifierAgent, holderAgent],
      [DidCommCredentialEventTypes.DidCommCredentialStateChanged, DidCommProofEventTypes.ProofStateChanged]
    )

    const [verifierConnection, holderConnection] = await makeConnection(verifierAgent, holderAgent)
    expect(holderConnection.theirDid).toBe(verifierConnection.did)
    verifierConnectionId = verifierConnection.id
    verifierDid = verifierConnection.did as string

    issuerKdv = await createDidKidVerificationMethod(verifierAgent.context)
    holderKdv = await createDidKidVerificationMethod(holderAgent.context)

    statusListUri = 'https://status.example.com/1'
    const signer = { method: 'did', didUrl: issuerKdv.kid } as const
    const { statusList } = await verifierAgent.tokenStatusList.createTokenStatusList<'jwt'>({
      format: 'jwt',
      signer,
      alg: 'EdDSA',
      statusList: { statusListLength: 16, bitsPerStatus: 1 },
      statusListUri,
    })
    const revoked = await verifierAgent.tokenStatusList.updateTokenStatusList<'jwt'>({
      format: 'jwt',
      token: statusList,
      status: { index: 1, status: 1 },
      signer,
      alg: 'EdDSA',
    })
    statusLists[statusListUri] = revoked.statusList
  })

  afterAll(async () => {
    await verifierAgent?.shutdown()
    await holderAgent?.shutdown()
  })

  const requestAndPresent = async (
    dcqlQuery: DcqlRequestAttachment['dcql_query']
  ): Promise<{ request: DcqlRequestAttachment; vpToken: DcqlPresentationAttachment['vp_token'] }> => {
    const verifierRecord = await verifierAgent.didcomm.proofs.requestProof({
      connectionId: verifierConnectionId,
      protocolVersion: 'v2',
      willConfirm: true,
      proofFormats: { dcql: { dcqlQuery } },
    })
    const threadId = verifierRecord.threadId

    const holderRecord = await waitForProofExchangeRecordSubject(holderReplay, {
      threadId,
      state: DidCommProofState.RequestReceived,
    })
    await holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })

    const verifierPresentationRecord = await waitForProofExchangeRecordSubject(verifierReplay, {
      threadId,
      state: DidCommProofState.PresentationReceived,
    })
    expect(verifierPresentationRecord.isVerified).toBe(true)

    const verifierDoneRecord = await verifierAgent.didcomm.proofs.acceptPresentation({
      proofExchangeRecordId: verifierPresentationRecord.id,
    })
    expect(verifierDoneRecord.state).toBe(DidCommProofState.Done)
    await waitForProofExchangeRecordSubject(holderReplay, { threadId, state: DidCommProofState.Done })

    const formatData = await verifierAgent.didcomm.proofs.getFormatData(verifierPresentationRecord.id)
    const request = formatData.request?.dcql as DcqlRequestAttachment
    const presentation = formatData.presentation?.dcql as DcqlPresentationAttachment
    expect(request.audience).toBe(`didcomm:${verifierDid}`)
    expect(request.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const requestMessage = findPlaintext(threadId, '/request-presentation')
    const presentationMessage = findPlaintext(threadId, '/presentation')
    expect(requestMessage.formats).toEqual([expect.objectContaining({ format: 'didcomm/dcql-request@v1.0' })])
    expect(presentationMessage.formats).toEqual([expect.objectContaining({ format: 'didcomm/dcql-presentation@v1.0' })])

    return { request, vpToken: presentation.vp_token }
  }

  test('dc+sd-jwt: present given_name and family_name', async () => {
    const sdJwtVc = await verifierAgent.sdJwtVc.sign({
      issuer: { method: 'did', didUrl: issuerKdv.kid },
      holder: { method: 'did', didUrl: holderKdv.kid },
      payload: { vct: VCT, given_name: 'Erika', family_name: 'Mustermann', address: { locality: 'Berlin' } },
      disclosureFrame: { _sd: ['given_name', 'family_name'], address: { _sd: ['locality'] } },
    })
    expect(sdJwtVc.payload.iss).toBe(issuerKdv.did)
    expect(sdJwtVc.payload.cnf).toEqual({ kid: holderKdv.kid })
    await holderAgent.sdJwtVc.store({
      record: SdJwtVcRecord.fromSdJwtVc(holderAgent.sdJwtVc.fromCompact(sdJwtVc.compact)),
    })

    const { request, vpToken } = await requestAndPresent({
      credentials: [
        {
          id: 'pid',
          format: 'dc+sd-jwt',
          meta: { vct_values: [VCT] },
          claims: [{ path: ['given_name'] }, { path: ['family_name'] }],
        },
      ],
    })

    const [, ...rest] = vpToken.pid[0].split('~')
    const kbJwt = decodeJwt(rest[rest.length - 1])
    const disclosures = decodeDisclosures(rest.slice(0, -1))
    expect(disclosures.map(([, name, value]) => [name, value]).sort()).toEqual([
      ['family_name', 'Mustermann'],
      ['given_name', 'Erika'],
    ])
    expect(kbJwt.header).toMatchObject({ typ: 'kb+jwt' })
    expect(kbJwt.payload).toMatchObject({ nonce: request.nonce, aud: request.audience, sd_hash: expect.any(String) })
  })

  test('vc+sd-jwt: present credentialSubject.name of an RFC 0881 credential', async () => {
    const offerRecord = await verifierAgent.didcomm.credentials.offerCredential({
      connectionId: verifierConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        w3cV2SdJwt: {
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential', 'ExampleNameCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'John', age: '25' },
          },
          bindingRequired: true,
          disclosureFrame: { credentialSubject: { _sd: ['name', 'age'] } },
          didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'] },
        },
      },
    })
    const credentialThreadId = offerRecord.threadId
    const holderOfferRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId: credentialThreadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOfferRecord.id,
      credentialFormats: { w3cV2SdJwt: { didCommSignedAttachment: { kid: holderKdv.kid } } },
    })
    const issuerRequestRecord = await waitForCredentialRecordSubject(verifierReplay, {
      threadId: credentialThreadId,
      state: DidCommCredentialState.RequestReceived,
    })
    await verifierAgent.didcomm.credentials.acceptRequest({
      credentialExchangeRecordId: issuerRequestRecord.id,
      credentialFormats: { w3cV2SdJwt: {} },
    })
    const holderCredentialRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId: credentialThreadId,
      state: DidCommCredentialState.CredentialReceived,
    })
    await holderAgent.didcomm.credentials.acceptCredential({ credentialExchangeRecordId: holderCredentialRecord.id })
    await waitForCredentialRecordSubject(verifierReplay, {
      threadId: credentialThreadId,
      state: DidCommCredentialState.Done,
    })

    const { request, vpToken } = await requestAndPresent({
      credentials: [
        {
          id: 'name',
          format: 'vc+sd-jwt',
          meta: { type_values: [['VerifiableCredential', 'ExampleNameCredential']] },
          claims: [{ path: ['credentialSubject', 'name'] }],
        },
      ],
    })

    const [vpJwt, vpDisclosures] = vpToken.name[0].split('~')
    expect(vpDisclosures).toBe('')
    const vp = decodeJwt(vpJwt) as {
      header: Record<string, unknown>
      payload: { verifiableCredential: Array<{ id: string }> } & Record<string, unknown>
    }
    expect(vp.header).toMatchObject({ typ: 'vp+sd-jwt', kid: holderKdv.kid })
    expect(vp.payload).toMatchObject({
      '@context': ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/ns/credentials/undefined-terms/v2'],
      holder: holderKdv.did,
      nonce: request.nonce,
      aud: request.audience,
      iat: expect.any(Number),
    })

    const [credentialJwt, ...credentialDisclosures] = vp.payload.verifiableCredential[0].id
      .slice('data:application/vc+sd-jwt,'.length)
      .split('~')
    const credentialPayload = decodeJwt(credentialJwt).payload as { cnf: { kid: string } }
    expect(vp.header.kid).toBe(credentialPayload.cnf.kid)
    const disclosures = decodeDisclosures(credentialDisclosures)
    expect(disclosures.map(([, name, value]) => [name, value])).toEqual([['name', 'John']])
  })

  const signSdJwtVc = async (payload: { vct: string; status?: JsonObject }, holderBinding = true): Promise<string> => {
    const { compact } = await verifierAgent.sdJwtVc.sign({
      issuer: { method: 'did', didUrl: issuerKdv.kid },
      holder: holderBinding ? { method: 'did', didUrl: holderKdv.kid } : undefined,
      payload: { ...payload, given_name: 'Erika' },
      disclosureFrame: { _sd: ['given_name'] },
    })
    return compact
  }

  const storeSdJwtVc = async (compact: string): Promise<void> => {
    await holderAgent.sdJwtVc.store({ record: SdJwtVcRecord.fromSdJwtVc(holderAgent.sdJwtVc.fromCompact(compact)) })
  }

  const pidQuery = (vct: string, requireHolderBinding?: boolean): DcqlQuery => ({
    credentials: [
      {
        id: 'pid',
        format: 'dc+sd-jwt',
        meta: { vct_values: [vct] },
        claims: [{ path: ['given_name'] }],
        require_cryptographic_holder_binding: requireHolderBinding,
      },
    ],
  })

  const mockPidPresentation = (createPid: (options: { challenge: string; domain?: string }) => Promise<string>) =>
    vi.spyOn(DcqlService.prototype, 'createPresentation').mockImplementationOnce(async (_agentContext, options) => ({
      dcqlPresentation: {},
      encodedDcqlPresentation: { pid: [await createPid(options)] },
    }))

  const presentationRejected = async (dcqlQuery: DcqlQuery): Promise<string> => {
    const { threadId } = await verifierAgent.didcomm.proofs.requestProof({
      connectionId: verifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: { dcql: { dcqlQuery } },
    })
    const holderRecord = await waitForProofExchangeRecordSubject(holderReplay, {
      threadId,
      state: DidCommProofState.RequestReceived,
    })
    await holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })

    const abandonedRecord = await waitForProofExchangeRecordSubject(verifierReplay, {
      threadId,
      state: DidCommProofState.Abandoned,
    })
    await waitForProofExchangeRecordSubject(holderReplay, { threadId, state: DidCommProofState.Abandoned })

    return abandonedRecord.errorMessage as string
  }

  test('dc+sd-jwt: a VALID status list entry is fetched over https and verified', async () => {
    const vct = `${VCT}/status-valid`
    await storeSdJwtVc(await signSdJwtVc({ vct, status: { status_list: { idx: 0, uri: statusListUri } } }))
    statusListFetcher.mockClear()

    await requestAndPresent(pidQuery(vct))
    expect(statusListFetcher).toHaveBeenCalledOnce()
    expect(statusListFetcher).toHaveBeenCalledWith(statusListUri, expect.anything())
  })

  test('dc+sd-jwt: an INVALID status list entry is rejected', async () => {
    const vct = `${VCT}/status-invalid`
    await storeSdJwtVc(await signSdJwtVc({ vct, status: { status_list: { idx: 1, uri: statusListUri } } }))

    expect(await presentationRejected(pidQuery(vct))).toContain('Status is not valid')
  })

  test('dc+sd-jwt: a status list uri that is not https is rejected without fetching it', async () => {
    const vct = `${VCT}/status-http`
    const uri = 'http://status.example.com/1'
    await storeSdJwtVc(await signSdJwtVc({ vct, status: { status_list: { idx: 0, uri } } }))
    statusListFetcher.mockClear()

    expect(await presentationRejected(pidQuery(vct))).toContain(`dc+sd-jwt status list 'uri' '${uri}' must use https`)
    expect(statusListFetcher).not.toHaveBeenCalled()
  })

  test("dc+sd-jwt: a 'vct' that is not in 'meta.vct_values' is rejected", async () => {
    const vct = `${VCT}/requested`
    await storeSdJwtVc(await signSdJwtVc({ vct }))
    const other = await signSdJwtVc({ vct: `${VCT}/other` })

    const createPresentationSpy = mockPidPresentation(({ challenge, domain }) =>
      holderAgent.sdJwtVc.present({
        sdJwtVc: other,
        presentationFrame: { given_name: true },
        verifierMetadata: { audience: domain as string, nonce: challenge, issuedAt: Math.floor(Date.now() / 1000) },
      })
    )
    const errorMessage = await presentationRejected(pidQuery(vct))
    createPresentationSpy.mockRestore()
    expect(errorMessage).toContain("dc+sd-jwt 'vct' is not one of the Credential Query 'meta.vct_values'")
  })

  test('dc+sd-jwt: without required holder binding a presentation without a KB-JWT is verified', async () => {
    const vct = `${VCT}/bearer`
    const bearer = await signSdJwtVc({ vct }, false)
    await storeSdJwtVc(bearer)

    const createPresentationSpy = mockPidPresentation(() =>
      holderAgent.sdJwtVc.present({ sdJwtVc: bearer, presentationFrame: { given_name: true } })
    )
    const { vpToken } = await requestAndPresent(pidQuery(vct, false))
    createPresentationSpy.mockRestore()
    expect(vpToken.pid[0]).toMatch(/~$/)
  })

  test('dc+sd-jwt: with required holder binding a presentation without a KB-JWT rejects the whole response', async () => {
    const vct = `${VCT}/bound`
    await storeSdJwtVc(await signSdJwtVc({ vct }))
    const bearer = await signSdJwtVc({ vct }, false)

    const createPresentationSpy = mockPidPresentation(() =>
      holderAgent.sdJwtVc.present({ sdJwtVc: bearer, presentationFrame: { given_name: true } })
    )
    const errorMessage = await presentationRejected(pidQuery(vct))
    createPresentationSpy.mockRestore()
    expect(errorMessage).toContain("vp_token entry for 'pid' has a wrong 'nonce' or 'aud'")
  })

  const requestRejectedAtReceipt = async (tamper: (request: Record<string, unknown>) => void): Promise<string> => {
    const originalCreateRequest = DidCommDcqlProofFormatService.prototype.createRequest
    const createRequestSpy = vi
      .spyOn(DidCommDcqlProofFormatService.prototype, 'createRequest')
      .mockImplementationOnce(async function (this: DidCommDcqlProofFormatService, ...args) {
        const result = await originalCreateRequest.apply(this, args)
        tamper(result.attachment.data.json as Record<string, unknown>)
        return result
      })

    const verifierRecord = await verifierAgent.didcomm.proofs.requestProof({
      connectionId: verifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        dcql: {
          dcqlQuery: {
            credentials: [{ id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: [VCT] } }],
          },
        },
      },
    })
    createRequestSpy.mockRestore()
    const threadId = verifierRecord.threadId

    const abandonedRecord = await waitForProofExchangeRecordSubject(verifierReplay, {
      threadId,
      state: DidCommProofState.Abandoned,
    })
    expect(await holderAgent.didcomm.proofs.findAllByQuery({ threadId })).toEqual([])
    expect(await verifierAgent.didcomm.proofs.findPresentationMessage(verifierRecord.id)).toBeNull()

    return abandonedRecord.errorMessage as string
  }

  test('prover rejects a request whose audience is not the connection DID', async () => {
    const errorMessage = await requestRejectedAtReceipt((request) => {
      request.audience = 'didcomm:did:example:other-verifier'
    })
    expect(errorMessage).toBe(
      "abandoned: DCQL request audience 'didcomm:did:example:other-verifier' is not the verifier DID of the connection"
    )
  })

  test('prover rejects a request with transaction_data', async () => {
    const errorMessage = await requestRejectedAtReceipt((request) => {
      request.transaction_data = []
    })
    expect(errorMessage).toBe("abandoned: DCQL request attachment must not have 'transaction_data'")
  })

  test('verifier rejects an audienceDid that is not the connection DID', async () => {
    await expect(
      verifierAgent.didcomm.proofs.requestProof({
        connectionId: verifierConnectionId,
        protocolVersion: 'v2',
        proofFormats: {
          dcql: {
            dcqlQuery: { credentials: [{ id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: [VCT] } }] },
            audienceDid: 'did:example:other-verifier',
          },
        },
      })
    ).rejects.toThrow("DCQL audienceDid 'did:example:other-verifier' is not the DID of connection")
  })

  const storeW3cV2SdJwt = async (
    type: string,
    credentialSubject: JsonObject,
    holderBinding = true
  ): Promise<W3cV2SdJwtVerifiableCredential> => {
    const credential = await verifierAgent.w3cV2Credentials.signCredential<ClaimFormat.SdJwtW3cVc>({
      format: ClaimFormat.SdJwtW3cVc,
      alg: 'EdDSA',
      verificationMethod: issuerKdv.kid,
      holder: holderBinding ? { method: 'did', didUrl: holderKdv.kid } : undefined,
      disclosureFrame: { credentialSubject: { _sd: ['name'] } },
      credential: new W3cV2Credential({
        context: ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential', type],
        issuer: issuerKdv.did,
        validFrom: new Date().toISOString(),
        credentialSubject: { ...credentialSubject, name: 'John' },
      }),
    })
    await holderAgent.w3cV2Credentials.store({ record: W3cV2CredentialRecord.fromCredential(credential) })
    return credential
  }

  const requestName = async (type: string): Promise<DidCommProofExchangeRecord> => {
    const { threadId } = await verifierAgent.didcomm.proofs.requestProof({
      connectionId: verifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        dcql: {
          dcqlQuery: {
            credentials: [
              {
                id: 'name',
                format: 'vc+sd-jwt',
                meta: { type_values: [[type]] },
                claims: [{ path: ['credentialSubject', 'name'] }],
              },
            ],
          },
        },
      },
    })

    return waitForProofExchangeRecordSubject(holderReplay, { threadId, state: DidCommProofState.RequestReceived })
  }

  const handSignedPresentationRejected = async (
    type: string,
    credentialSubject: JsonObject,
    holder: string
  ): Promise<{ kid?: string; errorMessage: string }> => {
    const credential = await storeW3cV2SdJwt(type, credentialSubject)
    const holderRecord = await requestName(type)
    const request = (await holderAgent.didcomm.proofs.getFormatData(holderRecord.id)).request
      ?.dcql as DcqlRequestAttachment

    const disclosed = await holderAgent.dependencyManager
      .resolve(W3cV2SdJwtCredentialService)
      .present(holderAgent.context, { credential, presentationFrame: { credentialSubject: { name: true } } })
    const presentation = await holderAgent.w3cV2Credentials.signPresentation<ClaimFormat.SdJwtW3cVp>({
      format: ClaimFormat.SdJwtW3cVp,
      presentation: new W3cV2Presentation({
        holder,
        verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(disclosed)],
      }),
      challenge: request.nonce,
      domain: request.audience,
    })

    const createPresentationSpy = vi
      .spyOn(DcqlService.prototype, 'createPresentation')
      .mockResolvedValueOnce({ dcqlPresentation: {}, encodedDcqlPresentation: { name: [presentation.encoded] } })
    await holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })
    createPresentationSpy.mockRestore()

    const abandonedRecord = await waitForProofExchangeRecordSubject(verifierReplay, {
      threadId: holderRecord.threadId,
      state: DidCommProofState.Abandoned,
    })
    await waitForProofExchangeRecordSubject(holderReplay, {
      threadId: holderRecord.threadId,
      state: DidCommProofState.Abandoned,
    })

    return { kid: presentation.sdJwt.header.kid, errorMessage: abandonedRecord.errorMessage as string }
  }

  test("verifier rejects a vp+sd-jwt that is not signed with the credential's cnf key", async () => {
    const otherKdv = await createDidKidVerificationMethod(holderAgent.context)

    const { kid, errorMessage } = await handSignedPresentationRejected(
      'ExampleCnfCredential',
      { id: otherKdv.did },
      otherKdv.did
    )
    expect(kid).toBe(otherKdv.kid)
    expect(errorMessage).toContain("vp+sd-jwt header 'kid' must be the credential 'cnf.kid'")
  })

  test("verifier rejects a vp+sd-jwt whose header 'kid' names the cnf key with another DID URL", async () => {
    const { keys } = await holderAgent.dids.resolveCreatedDidDocumentWithKeys(holderKdv.did)
    const { didState } = await holderAgent.dids.create<JwkDidCreateOptions>({
      method: 'jwk',
      options: { keyId: keys?.[0].kmsKeyId as string },
    })
    const didJwk = didState.did as string

    const { kid, errorMessage } = await handSignedPresentationRejected('ExampleCnfDidJwkCredential', {}, didJwk)
    expect(kid).toBe(`${didJwk}#0`)
    expect(errorMessage).toContain("vp+sd-jwt header 'kid' must be the credential 'cnf.kid'")
  })

  test("prover refuses a vc+sd-jwt query that requires holder binding for a credential without 'cnf'", async () => {
    await storeW3cV2SdJwt('ExampleNoCnfCredential', { id: holderKdv.did }, false)
    const holderRecord = await requestName('ExampleNoCnfCredential')

    await expect(holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })).rejects.toThrow(
      "Credential Query 'name' requires holder binding, but the selected vc+sd-jwt credential has no 'cnf'"
    )
    expect((await holderAgent.didcomm.proofs.getById(holderRecord.id)).state).toBe(DidCommProofState.RequestReceived)
  })
})

describe('DCQL proof format out of band', () => {
  let verifierAgent: DcqlAgent
  let holderAgent: DcqlAgent
  let verifierReplay: EventReplaySubject
  let holderReplay: EventReplaySubject

  const dcqlQuery: DcqlQuery = {
    credentials: [{ id: 'pid', format: 'dc+sd-jwt', meta: { vct_values: [VCT] }, claims: [{ path: ['given_name'] }] }],
  }

  beforeAll(async () => {
    verifierAgent = new Agent(
      getAgentOptions('DCQL out-of-band verifier', {}, {}, getModules('rxjs:dcql-oob-verifier'), {
        requireDidcomm: true,
      })
    )
    holderAgent = new Agent(
      getAgentOptions('DCQL out-of-band holder', {}, {}, getModules('rxjs:dcql-oob-holder'), { requireDidcomm: true })
    )

    setupSubjectTransports([verifierAgent, holderAgent])
    await verifierAgent.initialize()
    await holderAgent.initialize()
    ;[verifierReplay, holderReplay] = setupEventReplaySubjects(
      [verifierAgent, holderAgent],
      [DidCommProofEventTypes.ProofStateChanged]
    )

    const issuerKdv = await createDidKidVerificationMethod(verifierAgent.context)
    const holderKdv = await createDidKidVerificationMethod(holderAgent.context)
    const sdJwtVc = await verifierAgent.sdJwtVc.sign({
      issuer: { method: 'did', didUrl: issuerKdv.kid },
      holder: { method: 'did', didUrl: holderKdv.kid },
      payload: { vct: VCT, given_name: 'Erika' },
      disclosureFrame: { _sd: ['given_name'] },
    })
    await holderAgent.sdJwtVc.store({
      record: SdJwtVcRecord.fromSdJwtVc(holderAgent.sdJwtVc.fromCompact(sdJwtVc.compact)),
    })
  })

  afterAll(async () => {
    await verifierAgent?.shutdown()
    await holderAgent?.shutdown()
  })

  const getRouting = () =>
    verifierAgent.dependencyManager.resolve(DidCommRoutingService).getRouting(verifierAgent.context, {})

  const createRequest = (audienceDid: string) =>
    verifierAgent.didcomm.proofs.createRequest({
      protocolVersion: 'v2',
      willConfirm: true,
      proofFormats: { dcql: { dcqlQuery, audienceDid } },
    })

  const present = async (threadId: string): Promise<{ audience: string; kbJwtAudience: unknown }> => {
    const holderRecord = await waitForProofExchangeRecordSubject(holderReplay, {
      threadId,
      state: DidCommProofState.RequestReceived,
    })
    await holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })

    const verifierRecord = await waitForProofExchangeRecordSubject(verifierReplay, {
      threadId,
      state: DidCommProofState.PresentationReceived,
    })
    expect(verifierRecord.isVerified).toBe(true)
    await verifierAgent.didcomm.proofs.acceptPresentation({ proofExchangeRecordId: verifierRecord.id })
    await waitForProofExchangeRecordSubject(holderReplay, { threadId, state: DidCommProofState.Done })

    const formatData = await verifierAgent.didcomm.proofs.getFormatData(verifierRecord.id)
    const request = formatData.request?.dcql as DcqlRequestAttachment
    const presentation = formatData.presentation?.dcql as DcqlPresentationAttachment
    const { audience } = request
    const [vpToken] = presentation.vp_token.pid
    const kbJwt = decodeJwt(vpToken.split('~').pop() as string).payload as { aud: unknown }

    return { audience, kbJwtAudience: kbJwt.aud }
  }

  test('createRequest without a connection needs a bare audienceDid', async () => {
    await expect(
      verifierAgent.didcomm.proofs.createRequest({ protocolVersion: 'v2', proofFormats: { dcql: { dcqlQuery } } })
    ).rejects.toThrow('DCQL requests without a connection need proofFormats.dcql.audienceDid')
    await expect(createRequest('did:example:verifier#key-1')).rejects.toThrow(
      'DCQL requests without a connection need proofFormats.dcql.audienceDid'
    )
  })

  test('invitation without a handshake: the audience is the did:key of the service recipient key', async () => {
    const routing = await getRouting()
    const { message, proofRecord } = await createRequest(new DidKey(routing.recipientKey).did)
    const { outOfBandInvitation } = await verifierAgent.didcomm.oob.createInvitation({
      messages: [message],
      handshake: false,
      routing,
    })
    await holderAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, { label: 'holder' })

    const { audience, kbJwtAudience } = await present(proofRecord.threadId)
    expect(audience).toBe(`didcomm:${new DidKey(routing.recipientKey).did}`)
    expect(kbJwtAudience).toBe(audience)
  })

  test('invitation without a handshake: an audience that is not the service DID is rejected', async () => {
    const processRequestSpy = vi.spyOn(DidCommDcqlProofFormatService.prototype, 'processRequest')
    const { message, proofRecord } = await createRequest('did:example:other-verifier')
    const { outOfBandInvitation } = await verifierAgent.didcomm.oob.createInvitation({
      messages: [message],
      handshake: false,
      routing: await getRouting(),
    })
    await holderAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, { label: 'holder' })

    await vi.waitFor(() => expect(processRequestSpy).toHaveBeenCalledOnce(), { timeout: 10000 })
    const [{ value: processRequest }] = processRequestSpy.mock.results
    processRequestSpy.mockRestore()
    await expect(processRequest).rejects.toThrow(
      "DCQL request audience 'didcomm:did:example:other-verifier' is not the DID of the service the presentation goes to"
    )
    expect(await holderAgent.didcomm.proofs.findAllByQuery({ threadId: proofRecord.threadId })).toEqual([])
  })

  // The verifier stays in RequestSent: the dispatcher sends the problem report without the invitation pthid
  test('v1 invitation with a handshake: an attached request is rejected', async () => {
    const processRequestSpy = vi.spyOn(DidCommDcqlProofFormatService.prototype, 'processRequest')
    const routing = await getRouting()
    const { message, proofRecord } = await createRequest(new DidKey(routing.recipientKey).did)
    const { outOfBandInvitation } = await verifierAgent.didcomm.oob.createInvitation({
      messages: [message],
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
      routing,
    })
    await holderAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, { label: 'holder' })

    await vi.waitFor(() => expect(processRequestSpy).toHaveBeenCalledOnce(), { timeout: 10000 })
    const [{ value: processRequest }] = processRequestSpy.mock.results
    processRequestSpy.mockRestore()
    await expect(processRequest).rejects.toThrow(
      'DCQL request was attached to the invitation that created the connection. Send the request after the connection exists'
    )
    expect(await holderAgent.didcomm.proofs.findAllByQuery({ threadId: proofRecord.threadId })).toEqual([])
    expect(await verifierAgent.didcomm.proofs.findPresentationMessage(proofRecord.id)).toBeNull()
  })

  test('legacy connectionless: the audience is the did:key of the service recipient key', async () => {
    const routing = await getRouting()
    const { message, proofRecord } = await createRequest(new DidKey(routing.recipientKey).did)
    const { invitationUrl } = await verifierAgent.didcomm.oob.createLegacyConnectionlessInvitation({
      message,
      domain: 'https://verifier.example.com',
      routing,
    })
    await holderAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'holder' })

    const { audience, kbJwtAudience } = await present(proofRecord.threadId)
    expect(audience).toBe(`didcomm:${new DidKey(routing.recipientKey).did}`)
    expect(kbJwtAudience).toBe(audience)
  })
})
