import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type {
  AcceptOfferOptions,
  AcceptRequestOptions,
  OfferCredentialOptions,
} from '../../../CredentialsModuleOptions'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { prepareForIssuance, waitForCredentialRecordSubject, getBaseConfig } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Agent } from '../../../../../agent/Agent'
import { AutoAcceptCredential } from '../../../CredentialAutoAcceptType'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialState } from '../../../CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { V2CredentialPreview } from '../V2CredentialPreview'

const faberConfig = getBaseConfig('Faber connection-less Credentials V2', {
  endpoints: ['rxjs:faber'],
})

const aliceConfig = getBaseConfig('Alice connection-less Credentials V2', {
  endpoints: ['rxjs:alice'],
})

const credentialPreview = V2CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberReplay: ReplaySubject<CredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<CredentialStateChangedEvent>
  let credDefId: string
  let credSchemaId: string

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(faberMessages, subjectMap))
    await aliceAgent.initialize()

    const { definition, schema } = await prepareForIssuance(faberAgent, ['name', 'age'])
    credDefId = definition.id
    credSchemaId = schema.id

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

  test('Faber starts with V2 Indy connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    const offerOptions: OfferCredentialOptions = {
      comment: 'V2 Out of Band offer',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
      protocolVersion: CredentialProtocolVersion.V2,
      connectionId: '',
    }
    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.credentials.createOutOfBandOffer(
      offerOptions
    )

    await aliceAgent.receiveMessage(message.toJSON())

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')
    const acceptOfferOptions: AcceptOfferOptions = {
      credentialRecordId: aliceCredentialRecord.id,
    }
    aliceCredentialRecord.protocolVersion = CredentialProtocolVersion.V2

    const credentialRecord = await aliceAgent.credentials.acceptOffer(acceptOfferOptions)

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    const options: AcceptRequestOptions = {
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    }
    faberCredentialRecord = await faberAgent.credentials.acceptRequest(options)

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    aliceCredentialRecord = await aliceAgent.credentials.acceptCredential(
      aliceCredentialRecord.id,
      CredentialProtocolVersion.V2
    )

    testLogger.test('Faber waits for credential ack from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      metadata: {
        data: {
          '_internal/indyCredential': {
            schemaId: credSchemaId,
          },
        },
      },
      state: CredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      metadata: {
        data: {
          '_internal/indyCredential': {
            schemaId: credSchemaId,
          },
        },
      },
      state: CredentialState.Done,
      threadId: expect.any(String),
    })
  })

  test('Faber starts with V2 Indy connection-less credential offer to Alice with auto-accept enabled', async () => {
    const offerOptions: OfferCredentialOptions = {
      comment: 'V2 Out of Band offer',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
      protocolVersion: CredentialProtocolVersion.V2,
      autoAcceptCredential: AutoAcceptCredential.ContentApproved,
      connectionId: '',
    }
    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.credentials.createOutOfBandOffer(
      offerOptions
    )

    // Receive Message
    await aliceAgent.receiveMessage(message.toJSON())

    // Wait for it to be processed
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    const acceptOfferOptions: AcceptOfferOptions = {
      credentialRecordId: aliceCredentialRecord.id,
      autoAcceptCredential: AutoAcceptCredential.ContentApproved,
    }
    aliceCredentialRecord.protocolVersion = CredentialProtocolVersion.V2

    await aliceAgent.credentials.acceptOffer(acceptOfferOptions)

    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      metadata: {
        data: {
          '_internal/indyCredential': {
            schemaId: credSchemaId,
          },
        },
      },
      state: CredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: CredentialState.Done,
      threadId: expect.any(String),
    })
  })
})
