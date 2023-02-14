import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import type { AcceptCredentialOfferOptions, AcceptCredentialProposalOptions } from '../../../CredentialsApiOptions'
import type { Schema } from 'indy-sdk'

import { setupAnonCredsTests } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { AutoAcceptCredential } from '../../../models/CredentialAutoAcceptType'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { V2CredentialPreview } from '../messages/V2CredentialPreview'

describe('V2 Credentials Auto Accept', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let credentialDefinitionId: string
  let schema: Schema
  let faberConnectionId: string
  let aliceConnectionId: string

  const credentialPreview = V2CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
    'x-ray': 'some x-ray',
    profile_picture: 'profile picture',
  })
  const newCredentialPreview = V2CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
    'x-ray': 'another x-ray value',
    profile_picture: 'another profile picture',
  })

  describe("Auto accept on 'always'", () => {
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        holderAgent: aliceAgent,
        credentialDefinitionId,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupAnonCredsTests({
        issuerName: 'faber agent: always v2',
        holderName: 'alice agent: always v2',
        autoAcceptCredentials: AutoAcceptCredential.Always,
        attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
      }))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test("Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Alice begins listening for credential')
      const aliceCredReceivedPromise = waitForCredentialRecord(aliceAgent, {
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber begins listening for credential ack')
      const faberCredAckPromise = waitForCredentialRecord(faberAgent, {
        state: CredentialState.Done,
      })

      testLogger.test('Alice sends credential proposal to Faber')
      await aliceAgent.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Alice waits for credential from Faber')
      let aliceCredentialRecord = await aliceCredReceivedPromise

      testLogger.test('Faber waits for credential ack from Alice')
      aliceCredentialRecord = await faberCredAckPromise

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId: schema.id,
              credentialDefinitionId: credentialDefinitionId,
            },
          },
        },
        state: CredentialState.Done,
      })
    })

    test("Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Alice begins listening for credential')
      const aliceCredReceivedPromise = waitForCredentialRecord(aliceAgent, {
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber begins listening for credential ack')
      const faberCredAckPromise = waitForCredentialRecord(faberAgent, {
        state: CredentialState.Done,
      })

      testLogger.test('Faber sends credential offer to Alice')
      const schemaId = schema.id
      await faberAgent.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      })
      testLogger.test('Alice waits for credential from Faber')
      const aliceCredentialRecord = await aliceCredReceivedPromise
      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credentialDefinitionId,
            },
          },
        },
        credentials: [
          {
            credentialRecordType: 'indy',
            credentialRecordId: expect.any(String),
          },
        ],
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredentialRecord: CredentialExchangeRecord = await faberCredAckPromise
      expect(faberCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: CredentialState.Done,
      })
    })
  })

  describe("Auto accept on 'contentApproved'", () => {
    // FIXME: we don't need to set up the agent and create all schemas/credential definitions again, just change the auto accept credential setting
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        holderAgent: aliceAgent,
        credentialDefinitionId,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupAnonCredsTests({
        issuerName: 'Faber Agent: Always V2',
        holderName: 'Alice Agent: Always V2',
        autoAcceptCredentials: AutoAcceptCredential.Always,
        attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
      }))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test("Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      const schemaId = schema.id

      testLogger.test('Faber starts listening for credential proposal from Alice')
      const faberPropReceivedPromise = waitForCredentialRecord(faberAgent, {
        state: CredentialState.ProposalReceived,
      })

      await aliceAgent.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      const faberPropReceivedRecord = await faberPropReceivedPromise

      const aliceCredReceivedPromise = waitForCredentialRecord(aliceAgent, {
        threadId: faberPropReceivedRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      const faberCredAckPromise = waitForCredentialRecord(faberAgent, {
        threadId: faberPropReceivedRecord.threadId,
        state: CredentialState.Done,
      })

      const options: AcceptCredentialProposalOptions = {
        credentialRecordId: faberPropReceivedRecord.id,
        comment: 'V2 Indy Offer',
        credentialFormats: {
          indy: {
            credentialDefinitionId: credentialDefinitionId,
            attributes: credentialPreview.attributes,
          },
        },
      }
      testLogger.test('Faber sends credential offer to Alice')
      options.credentialRecordId = faberPropReceivedRecord.id
      await faberAgent.credentials.acceptProposal(options)

      testLogger.test('Alice waits for credential from Faber')
      const aliceCredReceivedRecord = await aliceCredReceivedPromise

      expect(aliceCredReceivedRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credentialDefinitionId,
            },
          },
        },
        credentials: [
          {
            credentialRecordType: 'indy',
            credentialRecordId: expect.any(String),
          },
        ],
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredAckRecord = await faberCredAckPromise

      expect(faberCredAckRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credentialDefinitionId,
            },
          },
        },
        state: CredentialState.Done,
      })
    })

    test("Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Alice starts listening for credential offer from Faber')
      const aliceOfferReceivedPromise = waitForCredentialRecord(aliceAgent, {
        state: CredentialState.OfferReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      const schemaId = schema.id
      await faberAgent.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      const aliceOfferReceivedRecord = await aliceOfferReceivedPromise

      expect(JsonTransformer.toJSON(aliceOfferReceivedRecord)).toMatchObject({
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceOfferReceivedRecord.id).not.toBeNull()
      expect(aliceOfferReceivedRecord.getTags()).toEqual({
        threadId: aliceOfferReceivedRecord.threadId,
        state: aliceOfferReceivedRecord.state,
        connectionId: aliceConnectionId,
        credentialIds: [],
      })
      testLogger.test('Alice received credential offer from Faber')

      testLogger.test('Alice starts listening for credential from Faber')
      const aliceCredReceivedPromise = waitForCredentialRecord(aliceAgent, {
        state: CredentialState.CredentialReceived,
      })

      const faberCredAckPromise = waitForCredentialRecord(faberAgent, {
        state: CredentialState.Done,
      })

      const acceptOfferOptions: AcceptCredentialOfferOptions = {
        credentialRecordId: aliceOfferReceivedRecord.id,
      }
      testLogger.test('alice sends credential request to faber')
      await aliceAgent.credentials.acceptOffer(acceptOfferOptions)

      testLogger.test('Alice waits for credential from Faber')
      const aliceCredReceivedRecord = await aliceCredReceivedPromise
      expect(aliceCredReceivedRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credentialDefinitionId,
            },
          },
        },
        credentials: [
          {
            credentialRecordType: 'indy',
            credentialRecordId: expect.any(String),
          },
        ],
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredAckRecord = await faberCredAckPromise

      expect(faberCredAckRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: CredentialState.Done,
      })
    })

    test("Alice starts with V2 credential proposal to Faber, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Faber starts listening for proposal from Alice')
      const faberPropReceivedPromise = waitForCredentialRecord(faberAgent, {
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Alice sends credential proposal to Faber')
      const aliceCredProposal = await aliceAgent.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v2 propose credential test',
      })
      expect(aliceCredProposal.state).toBe(CredentialState.ProposalSent)

      testLogger.test('Faber waits for credential proposal from Alice')
      const faberPropReceivedRecord = await faberPropReceivedPromise

      testLogger.test('Alice starts listening for credential offer from Faber')
      const aliceOfferReceivedPromise = waitForCredentialRecord(aliceAgent, {
        state: CredentialState.OfferReceived,
      })

      testLogger.test('Faber negotiated proposal, sending credential offer to Alice')
      const faberOfferSentRecord = await faberAgent.credentials.negotiateProposal({
        credentialRecordId: faberPropReceivedRecord.id,
        credentialFormats: {
          indy: {
            credentialDefinitionId: credentialDefinitionId,
            attributes: newCredentialPreview.attributes,
          },
        },
      })

      testLogger.test('Alice waits for credential offer from Faber')
      const aliceOfferReceivedRecord = await aliceOfferReceivedPromise

      // below values are not in json object
      expect(aliceOfferReceivedRecord.id).not.toBeNull()
      expect(aliceOfferReceivedRecord.getTags()).toEqual({
        threadId: aliceOfferReceivedRecord.threadId,
        state: aliceOfferReceivedRecord.state,
        connectionId: aliceConnectionId,
        credentialIds: [],
      })

      // Check if the state of the credential records did not change
      const faberRecord = await faberAgent.credentials.getById(faberOfferSentRecord.id)
      faberRecord.assertState(CredentialState.OfferSent)

      const aliceRecord = await aliceAgent.credentials.getById(aliceOfferReceivedRecord.id)
      aliceRecord.assertState(CredentialState.OfferReceived)
    })

    test("Faber starts with V2 credential offer to Alice, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Alice starts listening for offer from Faber')
      const aliceCredentialExchangeRecordPromise = waitForCredentialRecord(aliceAgent, {
        state: CredentialState.OfferReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      await faberAgent.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v2',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      const aliceOfferReceivedRecord = await aliceCredentialExchangeRecordPromise

      // below values are not in json object
      expect(aliceOfferReceivedRecord.id).not.toBeNull()
      expect(aliceOfferReceivedRecord.getTags()).toEqual({
        threadId: aliceOfferReceivedRecord.threadId,
        state: aliceOfferReceivedRecord.state,
        connectionId: aliceConnectionId,
        credentialIds: [],
      })

      testLogger.test('Faber starts listening for proposal received')
      const faberProposalReceivedPromise = waitForCredentialRecord(faberAgent, {
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Alice sends credential request to Faber')
      const aliceCredRequestRecord = await aliceAgent.credentials.negotiateOffer({
        credentialRecordId: aliceOfferReceivedRecord.id,
        credentialFormats: {
          indy: {
            attributes: newCredentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      const faberCredProposalRecord = await faberProposalReceivedPromise

      // Check if the state of fabers credential record did not change
      const faberRecord = await faberAgent.credentials.getById(faberCredProposalRecord.id)
      faberRecord.assertState(CredentialState.ProposalReceived)

      const aliceRecord = await aliceAgent.credentials.getById(aliceCredRequestRecord.id)
      aliceRecord.assertState(CredentialState.ProposalSent)
    })
  })
})
