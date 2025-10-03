import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import type { DidCommCredentialStateChangedEvent } from '../../../DidCommCredentialEvents'
import type {
  AcceptCredentialOfferOptions,
  AcceptCredentialRequestOptions,
} from '../../../DidCommCredentialsApiOptions'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { getAnonCredsIndyModules } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import {
  anoncredsDefinitionFourAttributesNoRevocation,
  storePreCreatedAnonCredsDefinition,
} from '../../../../../../../anoncreds/tests/preCreatedAnonCredsDefinition'
import { Agent } from '../../../../../../../core/src/agent/Agent'
import { getAgentOptions, waitForCredentialRecordSubject } from '../../../../../../../core/tests/helpers'
import testLogger from '../../../../../../../core/tests/logger'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import { DidCommAutoAcceptCredential } from '../../../models/DidCommCredentialAutoAcceptType'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { DidCommCredentialV2Preview } from '../messages'

const faberAgentOptions = getAgentOptions(
  'Faber connection-less Credentials V2',
  {
    endpoints: ['rxjs:faber'],
  },
  {},
  getAnonCredsIndyModules(),
  { requireDidcomm: true }
)

const aliceAgentOptions = getAgentOptions(
  'Alice connection-less Credentials V2',
  {
    endpoints: ['rxjs:alice'],
  },
  {},
  getAnonCredsIndyModules(),
  { requireDidcomm: true }
)

const credentialPreview = DidCommCredentialV2Preview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'true',
  profile_picture: 'looking_good',
})

describe('V2 Connectionless Credentials', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let faberReplay: ReplaySubject<DidCommCredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<DidCommCredentialStateChangedEvent>

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    faberAgent = new Agent(faberAgentOptions)
    faberAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    // Make sure the pre-created credential definition is in the wallet
    await storePreCreatedAnonCredsDefinition(faberAgent, anoncredsDefinitionFourAttributesNoRevocation)

    faberReplay = new ReplaySubject<DidCommCredentialStateChangedEvent>()
    aliceReplay = new ReplaySubject<DidCommCredentialStateChangedEvent>()

    faberAgent.events
      .observable<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged)
      .subscribe(faberReplay)
    aliceAgent.events
      .observable<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged)
      .subscribe(aliceReplay)
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Faber starts with connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    let { message, credentialExchangeRecord: faberCredentialRecord } = await faberAgent.didcomm.credentials.createOffer(
      {
        comment: 'V2 Out of Band offer',
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      }
    )

    const { invitationUrl } = await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')
    const acceptOfferOptions: AcceptCredentialOfferOptions = {
      credentialExchangeRecordId: aliceCredentialRecord.id,
    }
    const credentialExchangeRecord = await aliceAgent.didcomm.credentials.acceptOffer(acceptOfferOptions)

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialExchangeRecord.threadId,
      state: DidCommCredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    const options: AcceptCredentialRequestOptions = {
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    }
    faberCredentialRecord = await faberAgent.didcomm.credentials.acceptRequest(options)

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    aliceCredentialRecord = await aliceAgent.didcomm.credentials.acceptCredential({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for credential ack from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: DidCommCredentialExchangeRecord.type,
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
      state: DidCommCredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: DidCommCredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      metadata: {
        data: {
          '_anoncreds/credential': {
            credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
          },
        },
      },
      state: DidCommCredentialState.Done,
      threadId: expect.any(String),
    })
  })

  test('Faber starts with connection-less credential offer to Alice with auto-accept enabled', async () => {
    let { message, credentialExchangeRecord: faberCredentialRecord } = await faberAgent.didcomm.credentials.createOffer(
      {
        comment: 'V2 Out of Band offer',
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
        autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
      }
    )

    const { invitationUrl } = await faberAgent.didcomm.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    // Receive Message
    await aliceAgent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, { label: 'alice' })

    // Wait for it to be processed
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    await aliceAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
      autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
    })

    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })

    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: DidCommCredentialExchangeRecord.type,
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
      state: DidCommCredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: DidCommCredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: DidCommCredentialState.Done,
      threadId: expect.any(String),
    })
  })
})
