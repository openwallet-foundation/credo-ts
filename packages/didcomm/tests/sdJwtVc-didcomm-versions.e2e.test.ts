import { Agent, JsonEncoder } from '@credo-ts/core'
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
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Protocol,
  DidCommModule,
  DidCommSdJwtVcCredentialFormatService,
  DidCommV2EnvelopeService,
} from '../src'

const getModules = (endpoint: string) =>
  ({
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
})
