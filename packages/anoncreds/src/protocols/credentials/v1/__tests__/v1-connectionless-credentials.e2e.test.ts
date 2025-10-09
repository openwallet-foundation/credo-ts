import type { EventReplaySubject } from '../../../../../../core/tests'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'
import type { AcceptCredentialOfferOptions, AcceptCredentialRequestOptions } from '@credo-ts/didcomm'

import { AutoAcceptCredential, CredentialExchangeRecord, CredentialState, MessageReceiver } from '@credo-ts/didcomm'

import { waitForCredentialRecordSubject, testLogger } from '../../../../../../core/tests'
import { setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'
import { V1CredentialPreview } from '../messages'

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

describe('V1 Connectionless Credentials', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let faberReplay: EventReplaySubject
  let aliceReplay: EventReplaySubject
  let credentialDefinitionId: string
  let schemaId: string

  beforeEach(async () => {
    ;({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      schemaId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber connection-less Credentials V1',
      holderName: 'Alice connection-less Credentials V1',
      attributeNames: ['name', 'age'],
      createConnections: false,
    }))
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber starts with connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.modules.credentials.createOffer({
      comment: 'V1 Out of Band offer',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId,
        },
      },
      protocolVersion: 'v1',
    })

    const { invitationUrl } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })

    await aliceAgent.modules.oob.receiveInvitationFromUrl(invitationUrl)

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
      comment: 'V1 Indy Credential',
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
            schemaId,
            credentialDefinitionId,
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
            schemaId,
            credentialDefinitionId,
          },
        },
      },
      state: CredentialState.Done,
      threadId: expect.any(String),
    })
  })

  test('Faber starts with connection-less credential offer to Alice with auto-accept enabled', async () => {
    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.modules.credentials.createOffer({
      comment: 'V1 Out of Band offer',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId,
        },
      },
      protocolVersion: 'v1',
      autoAcceptCredential: AutoAcceptCredential.ContentApproved,
    })

    const { message: offerMessage } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
      message,
      domain: 'https://a-domain.com',
    })

    // Receive Message
    const messageReceiver = aliceAgent.context.dependencyManager.resolve(MessageReceiver)
    await messageReceiver.receiveMessage(offerMessage.toJSON())

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
            schemaId,
            credentialDefinitionId: credentialDefinitionId,
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
