import type { JsonObject } from '@credo-ts/core'
import { Agent, W3cV2SdJwtVerifiableCredential } from '@credo-ts/core'
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
  DidCommW3cV2SdJwtCredentialFormatService,
} from '../src'

const getModules = (endpoint: string) =>
  ({
    didcomm: new DidCommModule({
      endpoints: [endpoint],
      didcommVersions: ['v1', 'v2'],
      connections: { autoAcceptConnections: true },
      credentials: {
        credentialProtocols: [
          new DidCommCredentialV2Protocol({ credentialFormats: [new DidCommW3cV2SdJwtCredentialFormatService()] }),
        ],
      },
    }),
  }) as const

type W3cV2SdJwtAgent = Agent<ReturnType<typeof getModules>>

describe.each(['v1', 'v2'] as const)('vc+sd-jwt issuance over a DIDComm %s connection', (didCommVersion) => {
  let issuerAgent: W3cV2SdJwtAgent
  let holderAgent: W3cV2SdJwtAgent
  let issuerReplay: EventReplaySubject
  let holderReplay: EventReplaySubject
  let issuerConnectionId: string
  let issuerKdv: CreateDidKidVerificationMethodReturn
  let holderKdv: CreateDidKidVerificationMethodReturn

  beforeAll(async () => {
    issuerAgent = new Agent(
      getAgentOptions(
        `W3cV2SdJwt issuer ${didCommVersion}`,
        {},
        {},
        getModules(`rxjs:w3cv2sdjwt-issuer-${didCommVersion}`),
        { requireDidcomm: true }
      )
    )
    holderAgent = new Agent(
      getAgentOptions(
        `W3cV2SdJwt holder ${didCommVersion}`,
        {},
        {},
        getModules(`rxjs:w3cv2sdjwt-holder-${didCommVersion}`),
        { requireDidcomm: true }
      )
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

  const offerCredential = async (): Promise<string> => {
    const { threadId } = await issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerConnectionId,
      protocolVersion: 'v2',
      autoAcceptCredential: DidCommAutoAcceptCredential.Never,
      credentialFormats: {
        w3cV2SdJwt: {
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: issuerKdv.did,
            validFrom: new Date().toISOString(),
            credentialSubject: { name: 'Erika' },
          },
          bindingRequired: true,
          didCommSignedAttachmentBinding: { algsSupported: ['EdDSA'], didMethodsSupported: ['key'] },
        },
      },
    })
    return threadId
  }

  test('offer, request with a kid binding, issue and store', async () => {
    const threadId = await offerCredential()

    const holderOfferRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOfferRecord.id,
      credentialFormats: { w3cV2SdJwt: { didCommSignedAttachment: { kid: holderKdv.kid } } },
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
      { credentialRecordType: 'w3c-v2', credentialRecordId: expect.any(String) },
    ])

    const { firstCredential } = await holderAgent.w3cV2Credentials.getById(
      holderDoneRecord.credentials[0].credentialRecordId
    )
    expect(firstCredential).toBeInstanceOf(W3cV2SdJwtVerifiableCredential)
    expect((firstCredential as W3cV2SdJwtVerifiableCredential).sdJwt.prettyClaims.cnf).toEqual({
      kid: holderKdv.kid,
    })
  })

  test('sends issuance-abandoned when the binding proof has a wrong nonce', async () => {
    const acceptOffer = DidCommW3cV2SdJwtCredentialFormatService.prototype.acceptOffer
    vi.spyOn(DidCommW3cV2SdJwtCredentialFormatService.prototype, 'acceptOffer').mockImplementation(function (
      this: DidCommW3cV2SdJwtCredentialFormatService,
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

    const threadId = await offerCredential()

    const holderOfferRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOfferRecord.id,
      credentialFormats: { w3cV2SdJwt: { didCommSignedAttachment: { kid: holderKdv.kid } } },
    })

    const holderAbandonedRecord = await waitForCredentialRecordSubject(holderReplay, {
      threadId,
      state: DidCommCredentialState.Abandoned,
    })
    expect(holderAbandonedRecord.errorMessage).toBe('issuance-abandoned: Invalid nonce in signed attachment')

    const [issuerRecord] = await issuerAgent.didcomm.credentials.findAllByQuery({ threadId })
    expect(issuerRecord.state).toBe(DidCommCredentialState.OfferSent)
  })
})
