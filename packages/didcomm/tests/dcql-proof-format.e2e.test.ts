import {
  Agent,
  ClaimFormat,
  DcqlService,
  JsonEncoder,
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
import type { DcqlPresentationAttachment, DcqlRequestAttachment } from '../src'
import {
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Protocol,
  DidCommDcqlProofFormatService,
  DidCommEnvelopeService,
  DidCommModule,
  DidCommProofEventTypes,
  DidCommProofState,
  DidCommProofV2Protocol,
  DidCommW3cV2SdJwtCredentialFormatService,
} from '../src'

const VCT = 'https://credentials.example.com/identity_credential'

const getModules = (endpoint: string) =>
  ({
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
    })

    const [, ...credentialDisclosures] = vp.payload.verifiableCredential[0].id
      .slice('data:application/vc+sd-jwt,'.length)
      .split('~')
    const disclosures = decodeDisclosures(credentialDisclosures)
    expect(disclosures.map(([, name, value]) => [name, value])).toEqual([['name', 'John']])
  })

  test('prover rejects a request whose audience is not the connection DID', async () => {
    const originalCreateRequest = DidCommDcqlProofFormatService.prototype.createRequest
    const createRequestSpy = vi
      .spyOn(DidCommDcqlProofFormatService.prototype, 'createRequest')
      .mockImplementationOnce(async function (this: DidCommDcqlProofFormatService, ...args) {
        const result = await originalCreateRequest.apply(this, args)
        ;(result.attachment.data.json as Record<string, unknown>).audience = 'didcomm:did:example:other-verifier'
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

    const holderRecord = await waitForProofExchangeRecordSubject(holderReplay, {
      threadId,
      state: DidCommProofState.RequestReceived,
    })
    await expect(holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })).rejects.toThrow(
      "audience 'didcomm:did:example:other-verifier' does not match the DID of connection"
    )

    await holderAgent.didcomm.proofs.sendProblemReport({
      proofExchangeRecordId: holderRecord.id,
      description: 'audience does not match the connection',
    })
    await waitForProofExchangeRecordSubject(verifierReplay, { threadId, state: DidCommProofState.Abandoned })
    expect(await verifierAgent.didcomm.proofs.findPresentationMessage(verifierRecord.id)).toBeNull()
  })

  test("verifier rejects a vp+sd-jwt that is not signed with the credential's cnf key", async () => {
    const otherKdv = await createDidKidVerificationMethod(holderAgent.context)

    const credential = await verifierAgent.w3cV2Credentials.signCredential<ClaimFormat.SdJwtW3cVc>({
      format: ClaimFormat.SdJwtW3cVc,
      alg: 'EdDSA',
      verificationMethod: issuerKdv.kid,
      holder: { method: 'did', didUrl: holderKdv.kid },
      disclosureFrame: { credentialSubject: { _sd: ['name'] } },
      credential: new W3cV2Credential({
        context: ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential', 'ExampleCnfCredential'],
        issuer: issuerKdv.did,
        validFrom: new Date().toISOString(),
        credentialSubject: { id: otherKdv.did, name: 'John' },
      }),
    })
    await holderAgent.w3cV2Credentials.store({ record: W3cV2CredentialRecord.fromCredential(credential) })

    const verifierRecord = await verifierAgent.didcomm.proofs.requestProof({
      connectionId: verifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        dcql: {
          dcqlQuery: {
            credentials: [
              {
                id: 'name',
                format: 'vc+sd-jwt',
                meta: { type_values: [['ExampleCnfCredential']] },
                claims: [{ path: ['credentialSubject', 'name'] }],
              },
            ],
          },
        },
      },
    })
    const threadId = verifierRecord.threadId

    const holderRecord = await waitForProofExchangeRecordSubject(holderReplay, {
      threadId,
      state: DidCommProofState.RequestReceived,
    })
    const request = (await holderAgent.didcomm.proofs.getFormatData(holderRecord.id)).request
      ?.dcql as DcqlRequestAttachment

    const disclosed = await holderAgent.dependencyManager
      .resolve(W3cV2SdJwtCredentialService)
      .present(holderAgent.context, { credential, presentationFrame: { credentialSubject: { name: true } } })
    const presentation = await holderAgent.w3cV2Credentials.signPresentation<ClaimFormat.SdJwtW3cVp>({
      format: ClaimFormat.SdJwtW3cVp,
      presentation: new W3cV2Presentation({
        holder: otherKdv.did,
        verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(disclosed)],
      }),
      challenge: request.nonce,
      domain: request.audience,
    })
    expect(presentation.sdJwt.header.kid).toBe(otherKdv.kid)

    const createPresentationSpy = vi
      .spyOn(DcqlService.prototype, 'createPresentation')
      .mockResolvedValueOnce({ dcqlPresentation: {}, encodedDcqlPresentation: { name: [presentation.encoded] } })
    await holderAgent.didcomm.proofs.acceptRequest({ proofExchangeRecordId: holderRecord.id })
    createPresentationSpy.mockRestore()

    const abandonedRecord = await waitForProofExchangeRecordSubject(verifierReplay, {
      threadId,
      state: DidCommProofState.Abandoned,
    })
    expect(abandonedRecord.errorMessage).toContain("vp+sd-jwt is not signed with the credential 'cnf' key")
    await waitForProofExchangeRecordSubject(holderReplay, { threadId, state: DidCommProofState.Abandoned })
  })
})
