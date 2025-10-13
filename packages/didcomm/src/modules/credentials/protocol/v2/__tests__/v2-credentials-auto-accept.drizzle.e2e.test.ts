import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { setupAnonCredsTests } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { anoncredsDefinitionFourAttributesNoRevocation } from '../../../../../../../anoncreds/tests/preCreatedAnonCredsDefinition'
import type { EventReplaySubject } from '../../../../../../../core/tests'
import {
  waitForAgentMessageProcessedEventSubject,
  waitForCredentialRecord,
  waitForCredentialRecordSubject,
} from '../../../../../../../core/tests/helpers'
import testLogger from '../../../../../../../core/tests/logger'
import { DidCommCredentialRole } from '../../../models'
import { DidCommAutoAcceptCredential } from '../../../models/DidCommCredentialAutoAcceptType'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { DidCommProposeCredentialV2Message } from '../messages'
import { DidCommCredentialV2Preview } from '../messages/DidCommCredentialV2Preview'

describe('V2 Credentials Auto Accept', () => {
  let faberAgent: AnonCredsTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: AnonCredsTestsAgent
  let aliceReplay: EventReplaySubject
  let credentialDefinitionId: string
  let schemaId: string
  let faberConnectionId: string
  let aliceConnectionId: string

  const credentialPreview = DidCommCredentialV2Preview.fromRecord({
    name: 'John',
    age: '99',
    'x-ray': 'some x-ray',
    profile_picture: 'profile picture',
  })
  const newCredentialPreview = DidCommCredentialV2Preview.fromRecord({
    name: 'John',
    age: '99',
    'x-ray': 'another x-ray value',
    profile_picture: 'another profile picture',
  })

  describe("Auto accept on 'always'", () => {
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        issuerReplay: faberReplay,
        holderAgent: aliceAgent,
        holderReplay: aliceReplay,
        credentialDefinitionId,
        schemaId,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupAnonCredsTests({
        issuerName: 'faber agent: always v2',
        holderName: 'alice agent: always v2',
        autoAcceptCredentials: DidCommAutoAcceptCredential.Always,
        preCreatedDefinition: anoncredsDefinitionFourAttributesNoRevocation,
        useDrizzleStorage: 'sqlite',
      }))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    test("Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialRecord = await aliceAgent.didcomm.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.Done,
        threadId: aliceCredentialRecord.threadId,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      await waitForCredentialRecordSubject(faberReplay, {
        state: DidCommCredentialState.Done,
        threadId: aliceCredentialRecord.threadId,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
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
        state: DidCommCredentialState.Done,
      })
    })

    test("Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Faber sends credential offer to Alice')
      let faberCredentialRecord = await faberAgent.didcomm.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      })

      testLogger.test('Alice waits for credential from Faber')
      const aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.CredentialReceived,
        threadId: faberCredentialRecord.threadId,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_anoncreds/credentialRequest': expect.any(Object),
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
        state: DidCommCredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
        state: DidCommCredentialState.Done,
        threadId: faberCredentialRecord.threadId,
      })
      expect(faberCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: DidCommCredentialState.Done,
      })
    })
  })

  describe("Auto accept on 'contentApproved'", () => {
    // FIXME: we don't need to set up the agent and create all schemas/credential definitions again, just change the auto accept credential setting
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        issuerReplay: faberReplay,
        holderAgent: aliceAgent,
        holderReplay: aliceReplay,
        credentialDefinitionId,
        schemaId,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupAnonCredsTests({
        issuerName: 'Faber Agent: Always V2',
        holderName: 'Alice Agent: Always V2',
        autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        preCreatedDefinition: anoncredsDefinitionFourAttributesNoRevocation,
      }))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    test("Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')

      let aliceCredentialRecord = await aliceAgent.didcomm.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
        state: DidCommCredentialState.ProposalReceived,
        threadId: aliceCredentialRecord.threadId,
      })

      testLogger.test('Faber sends credential offer to Alice')
      await faberAgent.didcomm.credentials.acceptProposal({
        credentialExchangeRecordId: faberCredentialRecord.id,
        comment: 'V2 Indy Offer',
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: credentialDefinitionId,
            attributes: credentialPreview.attributes,
          },
        },
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.Done,
        threadId: faberCredentialRecord.threadId,
      })

      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: DidCommCredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_anoncreds/credentialRequest': expect.any(Object),
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
        state: DidCommCredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
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
        state: DidCommCredentialState.Done,
      })
    })

    test("Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Faber sends credential offer to Alice')
      let faberCredentialRecord = await faberAgent.didcomm.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.OfferReceived,
        threadId: faberCredentialRecord.threadId,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnectionId,
        role: DidCommCredentialRole.Holder,
        credentialIds: [],
      })
      testLogger.test('Alice received credential offer from Faber')

      testLogger.test('alice sends credential request to faber')
      await aliceAgent.didcomm.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.Done,
        threadId: faberCredentialRecord.threadId,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_anoncreds/credentialRequest': expect.any(Object),
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
        state: DidCommCredentialState.Done,
      })

      testLogger.test('Faber waits for credential ack from Alice')

      faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
        threadId: faberCredentialRecord.threadId,
        state: DidCommCredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: DidCommCredentialState.Done,
      })
    })

    test("Alice starts with V2 credential proposal to Faber, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialRecord = await aliceAgent.didcomm.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v2 propose credential test',
      })
      expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.ProposalSent)

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
        state: DidCommCredentialState.ProposalReceived,
        threadId: aliceCredentialRecord.threadId,
      })

      testLogger.test('Faber negotiated proposal, sending credential offer to Alice')
      faberCredentialRecord = await faberAgent.didcomm.credentials.negotiateProposal({
        credentialExchangeRecordId: faberCredentialRecord.id,
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: credentialDefinitionId,
            attributes: newCredentialPreview.attributes,
          },
        },
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.OfferReceived,
        threadId: faberCredentialRecord.threadId,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnectionId,
        role: DidCommCredentialRole.Holder,
        credentialIds: [],
      })
    })

    test("Faber starts with V2 credential offer to Alice, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Faber sends credential offer to Alice')
      const faberCredentialRecord = await faberAgent.didcomm.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          anoncreds: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      const aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        state: DidCommCredentialState.OfferReceived,
        threadId: faberCredentialRecord.threadId,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnectionId,
        role: DidCommCredentialRole.Holder,
        credentialIds: [],
      })

      testLogger.test('Alice sends credential request to Faber')
      await aliceAgent.didcomm.credentials.negotiateOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
        credentialFormats: {
          anoncreds: {
            attributes: newCredentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v2 propose credential test',
      })

      await waitForCredentialRecordSubject(faberReplay, {
        state: DidCommCredentialState.ProposalReceived,
        threadId: aliceCredentialRecord.threadId,
      })

      // ProposalReceived is emitted before the whole message is finished processing
      // So to not get errors when shutting down the agent, we wait for the message to be processed
      await waitForAgentMessageProcessedEventSubject(faberReplay, {
        threadId: aliceCredentialRecord.threadId,
        messageType: DidCommProposeCredentialV2Message.type.messageTypeUri,
      })
    })
  })
})
