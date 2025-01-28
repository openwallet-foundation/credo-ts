import type { EventReplaySubject } from '../../../../../../core/tests'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'

import { JsonTransformer } from '@credo-ts/core'
import { AutoAcceptCredential, CredentialState, CredentialExchangeRecord, CredentialRole } from '@credo-ts/didcomm'

import { waitForCredentialRecord, waitForCredentialRecordSubject, testLogger } from '../../../../../../core/tests'
import { setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'
import { V1CredentialPreview } from '../messages'

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'some x-ray',
  profile_picture: 'profile picture',
})
const newCredentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'another x-ray value',
  profile_picture: 'another profile picture',
})

describe('V1 Credentials Auto Accept', () => {
  let faberAgent: AnonCredsTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: AnonCredsTestsAgent
  let aliceReplay: EventReplaySubject
  let credentialDefinitionId: string
  let schemaId: string
  let faberConnectionId: string
  let aliceConnectionId: string

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
        issuerName: 'Faber Credentials Auto Accept V1',
        holderName: 'Alice Credentials Auto Accept V1',
        attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
        autoAcceptCredentials: AutoAcceptCredential.Always,
      }))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test("Alice starts with V1 credential proposal to Faber, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')

      const aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v1',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v1 propose credential test',
      })

      testLogger.test('Alice waits for credential from Faber')
      let aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      aliceCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_anoncreds/credential': {
              schemaId: schemaId,
              credentialDefinitionId: credentialDefinitionId,
            },
          },
        },
        state: CredentialState.Done,
      })
    })

    test("Faber starts with V1 credential offer to Alice, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Faber sends credential offer to Alice')
      const faberCredentialExchangeRecord = await faberAgent.modules.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v1',
      })
      testLogger.test('Alice waits for credential from Faber')
      const aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })
      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.Done,
      })
      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_anoncreds/credentialRequest': expect.any(Object),
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
        state: CredentialState.CredentialReceived,
      })
      expect(faberCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: CredentialState.Done,
      })
    })
  })

  describe("Auto accept on 'contentApproved'", () => {
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
        issuerName: 'faber agent: contentApproved v1',
        holderName: 'alice agent: contentApproved v1',
        attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
        autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      }))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    // ==============================
    // TESTS v1 BEGIN
    // ==========================
    test("Alice starts with V1 credential proposal to Faber, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v1',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialExchangeRecord = await waitForCredentialRecordSubject(faberReplay, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialExchangeRecord = await faberAgent.modules.credentials.acceptProposal({
        credentialRecordId: faberCredentialExchangeRecord.id,
        comment: 'V1 Indy Offer',
        credentialFormats: {
          indy: {
            credentialDefinitionId: credentialDefinitionId,
            attributes: credentialPreview.attributes,
          },
        },
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialExchangeRecord = await waitForCredentialRecordSubject(aliceReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialExchangeRecord = await waitForCredentialRecordSubject(faberReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialExchangeRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
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
        state: CredentialState.CredentialReceived,
      })

      expect(faberCredentialExchangeRecord).toMatchObject({
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
        state: CredentialState.Done,
      })
    })

    test("Faber starts with V1 credential offer to Alice, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Faber sends credential offer to Alice')
      let faberCredentialExchangeRecord = await faberAgent.modules.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v1',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      let aliceCredentialExchangeRecord = await waitForCredentialRecordSubject(aliceReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialExchangeRecord)).toMatchObject({
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialExchangeRecord.id).not.toBeNull()
      expect(aliceCredentialExchangeRecord.getTags()).toEqual({
        role: CredentialRole.Holder,
        parentThreadId: undefined,
        threadId: aliceCredentialExchangeRecord.threadId,
        state: aliceCredentialExchangeRecord.state,
        connectionId: aliceConnectionId,
        credentialIds: [],
      })

      testLogger.test('alice sends credential request to faber')
      faberCredentialExchangeRecord = await aliceAgent.modules.credentials.acceptOffer({
        credentialRecordId: aliceCredentialExchangeRecord.id,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialExchangeRecord = await waitForCredentialRecordSubject(aliceReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialExchangeRecord = await waitForCredentialRecordSubject(faberReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialExchangeRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
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
        state: CredentialState.CredentialReceived,
      })

      expect(faberCredentialExchangeRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: CredentialState.Done,
      })
    })

    test("Faber starts with V1 credential offer to Alice, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Faber sends credential offer to Alice')
      let faberCredentialExchangeRecord = await faberAgent.modules.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        protocolVersion: 'v1',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      let aliceCredentialExchangeRecord = await waitForCredentialRecordSubject(aliceReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialExchangeRecord.id).not.toBeNull()
      expect(aliceCredentialExchangeRecord.getTags()).toEqual({
        role: CredentialRole.Holder,
        parentThreadId: undefined,
        threadId: aliceCredentialExchangeRecord.threadId,
        state: aliceCredentialExchangeRecord.state,
        connectionId: aliceConnectionId,
        credentialIds: [],
      })

      testLogger.test('Alice sends credential request to Faber')
      const aliceExchangeCredentialRecord = await aliceAgent.modules.credentials.negotiateOffer({
        credentialRecordId: aliceCredentialExchangeRecord.id,
        credentialFormats: {
          indy: {
            attributes: newCredentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v1 propose credential test',
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      faberCredentialExchangeRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceExchangeCredentialRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      // Check if the state of fabers credential record did not change
      const faberRecord = await faberAgent.modules.credentials.getById(faberCredentialExchangeRecord.id)
      faberRecord.assertState(CredentialState.ProposalReceived)

      aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.getById(aliceCredentialExchangeRecord.id)
      aliceCredentialExchangeRecord.assertState(CredentialState.ProposalSent)
    })

    test("Alice starts with V1 credential proposal to Faber, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      const aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v1',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credentialDefinitionId,
          },
        },
        comment: 'v1 propose credential test',
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialExchangeRecord = await waitForCredentialRecordSubject(faberReplay, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      await faberAgent.modules.credentials.negotiateProposal({
        credentialRecordId: faberCredentialExchangeRecord.id,
        credentialFormats: {
          indy: {
            credentialDefinitionId: credentialDefinitionId,
            attributes: newCredentialPreview.attributes,
          },
        },
      })

      testLogger.test('Alice waits for credential offer from Faber')

      const record = await waitForCredentialRecordSubject(aliceReplay, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(record.id).not.toBeNull()
      expect(record.getTags()).toEqual({
        role: CredentialRole.Holder,
        parentThreadId: undefined,
        threadId: record.threadId,
        state: record.state,
        connectionId: aliceConnectionId,
        credentialIds: [],
      })

      // Check if the state of the credential records did not change
      faberCredentialExchangeRecord = await faberAgent.modules.credentials.getById(faberCredentialExchangeRecord.id)
      faberCredentialExchangeRecord.assertState(CredentialState.OfferSent)

      const aliceRecord = await aliceAgent.modules.credentials.getById(record.id)
      aliceRecord.assertState(CredentialState.OfferReceived)
    })
  })
})
