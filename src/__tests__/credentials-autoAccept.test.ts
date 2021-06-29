import type { Agent } from '../agent/Agent'
import type { ConnectionRecord } from '../modules/connections'

import {
  CredentialPreview,
  CredentialPreviewAttribute,
  CredentialRecord,
  CredentialState,
} from '../modules/credentials'
import { AutoAcceptCredential } from '../types'
import { JsonTransformer } from '../utils/JsonTransformer'
import { sleep } from '../utils/sleep'

import { setupCredentialTests, waitForCredentialRecord } from './helpers'
import testLogger from './logger'

const credentialPreview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
  ],
})

const newCredentialPreview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
    new CredentialPreviewAttribute({
      name: 'lastname',
      mimeType: 'text/plain',
      value: 'Appleseed',
    }),
  ],
})

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let schemaId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let faberCredentialRecord: CredentialRecord
  let aliceCredentialRecord: CredentialRecord

  describe('(DEFAULT) Auto accept on `never`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, schemaId, faberConnection, aliceConnection } = await setupCredentialTests(
        'faber agent never',
        'alice agent never',
        AutoAcceptCredential.never
      ))
    })

    afterAll(async () => {
      await faberAgent.closeAndDeleteWallet()
      await aliceAgent.closeAndDeleteWallet()
    })

    test('Alice starts with credential proposal to Faber', async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialRecord = await aliceAgent.credentials.proposeCredential(aliceConnection.id, {
        credentialProposal: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialRecord = await faberAgent.credentials.acceptProposal(faberCredentialRecord.id, {
        comment: 'some comment about credential',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          comment: 'some comment about credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: faberCredentialRecord.threadId,
        connectionId: aliceCredentialRecord.connectionId,
        state: aliceCredentialRecord.state,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('Alice sends credential request to Faber')
      aliceCredentialRecord = await aliceAgent.credentials.acceptOffer(aliceCredentialRecord.id)

      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Faber sends credential to Alice')
      faberCredentialRecord = await faberAgent.credentials.acceptRequest(faberCredentialRecord.id)

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Alice sends credential ack to Faber')
      aliceCredentialRecord = await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id)

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: expect.any(String),
        connectionId: expect.any(String),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: {
          requestMetadata: expect.any(Object),
          schemaId,
          credentialDefinitionId: credDefId,
        },
        credentialId: expect.any(String),
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: expect.any(String),
        connectionId: expect.any(String),
        metadata: {
          schemaId,
          credentialDefinitionId: credDefId,
        },
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
      })
    })

    test('Faber starts with credential offer to Alice', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialRecord = await faberAgent.credentials.offerCredential(faberConnection.id, {
        preview: credentialPreview,
        credentialDefinitionId: credDefId,
        comment: 'some comment about credential',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          comment: 'some comment about credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: faberCredentialRecord.threadId,
        connectionId: aliceConnection.id,
        state: aliceCredentialRecord.state,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('Alice sends credential request to Faber')
      aliceCredentialRecord = await aliceAgent.credentials.acceptOffer(aliceCredentialRecord.id)

      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Faber sends credential to Alice')
      faberCredentialRecord = await faberAgent.credentials.acceptRequest(faberCredentialRecord.id)

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Alice sends credential ack to Faber')
      aliceCredentialRecord = await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id)

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: { requestMetadata: expect.any(Object) },
        credentialId: expect.any(String),
        state: CredentialState.Done,
        threadId: expect.any(String),
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
        threadId: expect.any(String),
        connectionId: expect.any(String),
      })
    })
  })

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, schemaId, faberConnection, aliceConnection } = await setupCredentialTests(
        'faber agent always',
        'alice agent always',
        AutoAcceptCredential.always
      ))
    })

    afterAll(async () => {
      await faberAgent.closeAndDeleteWallet()
      await aliceAgent.closeAndDeleteWallet()
    })

    test('Alice starts with credential proposal to Faber, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialRecord = await aliceAgent.credentials.proposeCredential(aliceConnection.id, {
        credentialProposal: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: {
          requestMetadata: expect.any(Object),
          schemaId,
          credentialDefinitionId: credDefId,
        },
        credentialId: expect.any(String),
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          schemaId,
          credentialDefinitionId: credDefId,
        },
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
      })
    })

    test('Faber starts with credential offer to Alice, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialRecord = await faberAgent.credentials.offerCredential(faberConnection.id, {
        preview: credentialPreview,
        credentialDefinitionId: credDefId,
        comment: 'some comment about credential',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          comment: 'some comment about credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: { requestMetadata: expect.any(Object) },
        credentialId: expect.any(String),
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
      })
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, schemaId, faberConnection, aliceConnection } = await setupCredentialTests(
        'faber agent contentApproved',
        'alice agent contentApproved',
        AutoAcceptCredential.contentApproved
      ))
    })

    afterAll(async () => {
      await faberAgent.closeAndDeleteWallet()
      await aliceAgent.closeAndDeleteWallet()
    })

    test('Alice starts with credential proposal to Faber, both with autoAcceptCredential on `contentApproved`', async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialRecord = await aliceAgent.credentials.proposeCredential(aliceConnection.id, {
        credentialProposal: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialRecord = await faberAgent.credentials.acceptProposal(faberCredentialRecord.id)

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: {
          requestMetadata: expect.any(Object),
          schemaId,
          credentialDefinitionId: credDefId,
        },
        credentialId: expect.any(String),
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          schemaId,
          credentialDefinitionId: credDefId,
        },
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
      })
    })

    test('Faber starts with credential offer to Alice, both with autoAcceptCredential on `contentApproved`', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialRecord = await faberAgent.credentials.offerCredential(faberConnection.id, {
        preview: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('alice sends credential request to faber')
      aliceCredentialRecord = await aliceAgent.credentials.acceptOffer(aliceCredentialRecord.id)

      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: { requestMetadata: expect.any(Object) },
        credentialId: expect.any(String),
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
      })
    })

    test('Alice starts with credential proposal to Faber, both have autoAcceptCredential on `contentApproved` and attributes did change', async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      let aliceCredentialRecord = await aliceAgent.credentials.proposeCredential(aliceConnection.id, {
        credentialProposal: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      faberCredentialRecord = await faberAgent.credentials.negotiateProposal(
        faberCredentialRecord.id,
        newCredentialPreview
      )

      testLogger.test('Alice waits for credential offer from Faber')

      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
              {
                name: 'lastname',
                'mime-type': 'text/plain',
                value: 'Appleseed',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      // Wait for ten seconds
      await sleep(10000)

      // Check if the state of the credential records did not change
      faberCredentialRecord = await faberAgent.credentials.getById(faberCredentialRecord.id)
      faberCredentialRecord.assertState(CredentialState.OfferSent)

      aliceCredentialRecord = await aliceAgent.credentials.getById(aliceCredentialRecord.id)
      aliceCredentialRecord.assertState(CredentialState.OfferReceived)
    })

    test('Faber starts with credential offer to Alice, both have autoAcceptCredential on `contentApproved` and attributes did change', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      faberCredentialRecord = await faberAgent.credentials.offerCredential(faberConnection.id, {
        preview: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        offerMessage: {
          '@id': expect.any(String),
          '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
          credential_preview: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
            ],
          },
          'offers~attach': expect.any(Array),
        },
        state: CredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialRecord.name)

      testLogger.test('Alice sends credential request to Faber')
      aliceCredentialRecord = await aliceAgent.credentials.negotiateOffer(
        aliceCredentialRecord.id,
        newCredentialPreview
      )

      expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
        createdAt: expect.any(Date),
        proposalMessage: {
          '@type': 'https://didcomm.org/issue-credential/1.0/propose-credential',
          '@id': expect.any(String),
          credential_proposal: {
            '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
            attributes: [
              {
                name: 'name',
                'mime-type': 'text/plain',
                value: 'John',
              },
              {
                name: 'age',
                'mime-type': 'text/plain',
                value: '99',
              },
              {
                name: 'lastname',
                'mime-type': 'text/plain',
                value: 'Appleseed',
              },
            ],
          },
          '~thread': { thid: expect.any(String) },
        },
        state: CredentialState.ProposalSent,
      })

      // Wait for ten seconds
      await sleep(10000)

      // Check if the state of fabers credential record did not change
      faberCredentialRecord = await faberAgent.credentials.getById(faberCredentialRecord.id)
      faberCredentialRecord.assertState(CredentialState.ProposalReceived)

      aliceCredentialRecord = await aliceAgent.credentials.getById(aliceCredentialRecord.id)
      aliceCredentialRecord.assertState(CredentialState.ProposalSent)
    })
  })
})
