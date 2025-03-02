import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { AcceptCredentialOfferOptions, AcceptCredentialRequestOptions } from '../../../CredentialsApiOptions'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { getAnonCredsIndyModules } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import {
  anoncredsDefinitionFourAttributesNoRevocation,
  storePreCreatedAnonCredsDefinition,
} from '../../../../../../../anoncreds/tests/preCreatedAnonCredsDefinition'
import { Agent } from '../../../../../../../core/src/agent/Agent'
import { getInMemoryAgentOptions, waitForCredentialRecordSubject } from '../../../../../../../core/tests/helpers'
import testLogger from '../../../../../../../core/tests/logger'
import { MessageReceiver } from '../../../../../MessageReceiver'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { AutoAcceptCredential } from '../../../models/CredentialAutoAcceptType'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { V2CredentialPreview } from '../messages'

const faberAgentOptions = getInMemoryAgentOptions(
  'Faber connection-less Credentials V2',
  {
    endpoints: ['rxjs:faber'],
  },
  {},
  getAnonCredsIndyModules()
)

const aliceAgentOptions = getInMemoryAgentOptions(
  'Alice connection-less Credentials V2',
  {
    endpoints: ['rxjs:alice'],
  },
  {},
  getAnonCredsIndyModules()
)

const credentialPreview = V2CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'true',
  profile_picture: 'looking_good',
})

describe('V2 Connectionless Credentials', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let faberReplay: ReplaySubject<CredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<CredentialStateChangedEvent>

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    faberAgent = new Agent(faberAgentOptions)
    faberAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    // Make sure the pre-created credential definition is in the wallet
    await storePreCreatedAnonCredsDefinition(faberAgent, anoncredsDefinitionFourAttributesNoRevocation)

    faberReplay = new ReplaySubject<CredentialStateChangedEvent>()
    aliceReplay = new ReplaySubject<CredentialStateChangedEvent>()

    faberAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(faberReplay)
    aliceAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(aliceReplay)
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber starts with connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.modules.credentials.createOffer({
      comment: 'V2 Out of Band offer',
      credentialFormats: {
        anoncreds: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
        },
      },
      protocolVersion: 'v2',
    })

    const { message: offerMessage } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.dependencyManager.resolve(MessageReceiver).receiveMessage(offerMessage.toJSON())

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')
    const acceptOfferOptions: AcceptCredentialOfferOptions = {
      credentialRecordId: aliceCredentialRecord.id,
    }
    const credentialRecord = await aliceAgent.modules.credentials.acceptOffer(acceptOfferOptions)

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    const options: AcceptCredentialRequestOptions = {
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    }
    faberCredentialRecord = await faberAgent.modules.credentials.acceptRequest(options)

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    aliceCredentialRecord = await aliceAgent.modules.credentials.acceptCredential({
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
      metadata: {
        data: {
          '_anoncreds/credential': {
            credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
          },
        },
      },
      credentials: [
        {
          credentialRecordType: 'w3c',
          credentialRecordId: expect.any(String),
        },
      ],
      state: CredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      metadata: {
        data: {
          '_anoncreds/credential': {
            credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
          },
        },
      },
      state: CredentialState.Done,
      threadId: expect.any(String),
    })
  })

  test('Faber starts with connection-less credential offer to Alice with auto-accept enabled', async () => {
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.modules.credentials.createOffer({
      comment: 'V2 Out of Band offer',
      credentialFormats: {
        anoncreds: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
        },
      },
      protocolVersion: 'v2',
      autoAcceptCredential: AutoAcceptCredential.ContentApproved,
    })

    const { message: offerMessage } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    // Receive Message
    await aliceAgent.context.dependencyManager.resolve(MessageReceiver).receiveMessage(offerMessage.toJSON())

    // Wait for it to be processed
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    await aliceAgent.modules.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
      autoAcceptCredential: AutoAcceptCredential.ContentApproved,
    })

    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      metadata: {
        data: {
          '_anoncreds/credential': {
            credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
          },
        },
      },
      credentials: [
        {
          credentialRecordType: 'w3c',
          credentialRecordId: expect.any(String),
        },
      ],
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
