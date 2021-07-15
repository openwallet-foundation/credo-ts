import type { Agent } from '../agent/Agent'
import type { ConnectionRecord } from '../modules/connections'

import { Attachment, AttachmentData } from '../decorators/attachment/Attachment'
import {
  CredentialPreview,
  CredentialPreviewAttribute,
  CredentialRecord,
  CredentialState,
} from '../modules/credentials'
import { JsonTransformer } from '../utils/JsonTransformer'
import { LinkedAttachment } from '../utils/LinkedAttachment'

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

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let schemaId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let faberCredentialRecord: CredentialRecord
  let aliceCredentialRecord: CredentialRecord

  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, credDefId, schemaId, faberConnection, aliceConnection } = await setupCredentialTests(
      'faber agent alwaysx',
      'alice agent alwaysx'
    ))
  })

  afterAll(async () => {
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
    await faberAgent.shutdown({
      deleteWallet: true,
    })
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

  test('Alice starts with credential proposal, with attachments, to Faber', async () => {
    testLogger.test('Alice sends credential proposal to Faber')
    let aliceCredentialRecord = await aliceAgent.credentials.proposeCredential(aliceConnection.id, {
      credentialProposal: credentialPreview,
      credentialDefinitionId: credDefId,
      linkedAttachments: [
        new LinkedAttachment({
          name: 'profile_picture',
          attachment: new Attachment({
            mimeType: 'image/png',
            data: new AttachmentData({ base64: 'base64encodedpic' }),
          }),
        }),
      ],
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
            {
              name: 'profile_picture',
              'mime-type': 'image/png',
              value: 'hl:zQmcKEWE6eZWpVqGKhbmhd8SxWBa9fgLX7aYW8RJzeHQMZg',
            },
          ],
        },
        '~attach': [{ '@id': 'zQmcKEWE6eZWpVqGKhbmhd8SxWBa9fgLX7aYW8RJzeHQMZg' }],
        'offers~attach': expect.any(Array),
      },
      state: CredentialState.OfferReceived,
    })

    // below values are not in json object
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      state: aliceCredentialRecord.state,
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
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

  test('Faber starts with credential, with attachments, offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')
    faberCredentialRecord = await faberAgent.credentials.offerCredential(faberConnection.id, {
      preview: credentialPreview,
      credentialDefinitionId: credDefId,
      comment: 'some comment about credential',
      linkedAttachments: [
        new LinkedAttachment({
          name: 'x-ray',
          attachment: new Attachment({
            data: new AttachmentData({
              base64: 'secondbase64encodedpic',
            }),
          }),
        }),
      ],
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
            {
              name: 'x-ray',
              value: 'hl:zQmVYZR9aDF47we8cmAaCP1vpXNoF1R5whSwaQUmVAZAjnG',
            },
          ],
        },
        '~attach': [{ '@id': 'zQmVYZR9aDF47we8cmAaCP1vpXNoF1R5whSwaQUmVAZAjnG' }],
        'offers~attach': expect.any(Array),
      },
      state: CredentialState.OfferReceived,
    })

    // below values are not in json object
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      state: aliceCredentialRecord.state,
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
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
      requestMessage: expect.any(Object),
      metadata: { requestMetadata: expect.any(Object) },
      credentialId: expect.any(String),
      state: CredentialState.Done,
    })

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialRecord.name,
      id: expect.any(String),
      createdAt: expect.any(Date),
      requestMessage: expect.any(Object),
      state: CredentialState.Done,
    })
  })
})
