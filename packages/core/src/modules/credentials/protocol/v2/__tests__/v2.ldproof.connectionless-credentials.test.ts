import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { Wallet } from '../../../../../wallet'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { JsonCredential, JsonLdCredentialDetailFormat } from '../../../formats/jsonld/JsonLdCredentialFormat'
import type { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { getAgentOptions, prepareForIssuance, waitForCredentialRecordSubject } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Agent } from '../../../../../agent/Agent'
import { InjectionSymbols } from '../../../../../constants'
import { KeyType } from '../../../../../crypto'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { W3cVcModule } from '../../../../vc'
import { customDocumentLoader } from '../../../../vc/__tests__/documentLoader'
import { CREDENTIALS_CONTEXT_V1_URL } from '../../../../vc/constants'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { CredentialsModule } from '../../../CredentialsModule'
import { JsonLdCredentialFormatService } from '../../../formats'
import { CredentialState } from '../../../models'
import { CredentialExchangeRecord } from '../../../repository'
import { V2CredentialProtocol } from '../V2CredentialProtocol'

const faberAgentOptions = getAgentOptions(
  'Faber LD connection-less Credentials V2',
  {
    endpoints: ['rxjs:faber'],
  },
  {
    credentials: new CredentialsModule({
      credentialProtocols: [new V2CredentialProtocol({ credentialFormats: [new JsonLdCredentialFormatService()] })],
    }),
    w3cVc: new W3cVcModule({
      documentLoader: customDocumentLoader,
    }),
  }
)

const aliceAgentOptions = getAgentOptions(
  'Alice LD connection-less Credentials V2',
  {
    endpoints: ['rxjs:alice'],
  },
  {
    credentials: new CredentialsModule({
      credentialProtocols: [new V2CredentialProtocol({ credentialFormats: [new JsonLdCredentialFormatService()] })],
    }),
    w3cVc: new W3cVcModule({
      documentLoader: customDocumentLoader,
    }),
  }
)

let wallet
let signCredentialOptions: JsonLdCredentialDetailFormat

describe('credentials', () => {
  let faberAgent: Agent<typeof faberAgentOptions['modules']>
  let aliceAgent: Agent<typeof aliceAgentOptions['modules']>
  let faberReplay: ReplaySubject<CredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<CredentialStateChangedEvent>
  const seed = 'testseed000000000000000000000001'
  const TEST_LD_DOCUMENT: JsonCredential = {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
  }
  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    faberAgent = new Agent(faberAgentOptions)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    await prepareForIssuance(faberAgent, ['name', 'age'])

    faberReplay = new ReplaySubject<CredentialStateChangedEvent>()
    aliceReplay = new ReplaySubject<CredentialStateChangedEvent>()

    faberAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(faberReplay)
    aliceAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(aliceReplay)
    wallet = faberAgent.injectionContainer.resolve<Wallet>(InjectionSymbols.Wallet)

    await wallet.createKey({ seed, keyType: KeyType.Ed25519 })

    signCredentialOptions = {
      credential: TEST_LD_DOCUMENT,
      options: {
        proofType: 'Ed25519Signature2018',
        proofPurpose: 'assertionMethod',
      },
    }
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber starts with V2 W3C connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.credentials.createOffer({
      comment: 'V2 Out of Band offer (W3C)',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      protocolVersion: 'v2',
    })

    const offerMsg = message as V2OfferCredentialMessage
    const attachment = offerMsg?.offerAttachments[0]

    if (attachment.data.base64) {
      expect(JsonEncoder.fromBase64(attachment.data.base64)).toMatchObject({
        credential: {
          '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
          type: ['VerifiableCredential', 'UniversityDegreeCredential'],
          issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          issuanceDate: '2017-10-22T12:23:48Z',
          credentialSubject: {
            degree: {
              name: 'Bachelor of Science and Arts',
              type: 'BachelorDegree',
            },
          },
        },
        options: {
          proofType: 'Ed25519Signature2018',
          proofPurpose: 'assertionMethod',
        },
      })
    }

    const { message: offerMessage } = await faberAgent.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })
    await aliceAgent.receiveMessage(offerMessage.toJSON())

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')

    const credentialRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    faberCredentialRecord = await faberAgent.credentials.acceptRequest({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    aliceCredentialRecord = await aliceAgent.credentials.acceptCredential({
      credentialRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for credential ack from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: CredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: CredentialState.Done,
      threadId: expect.any(String),
    })
  })
})
