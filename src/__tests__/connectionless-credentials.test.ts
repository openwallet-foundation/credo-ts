import { Subject } from 'rxjs'

import { Agent } from '../agent/Agent'
import {
  CredentialRecord,
  CredentialState,
  CredentialPreview,
  CredentialPreviewAttribute,
} from '../modules/credentials'
import { JsonTransformer } from '../utils/JsonTransformer'

import {
  ensurePublicDidIsOnLedger,
  registerDefinition,
  registerSchema,
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  waitForCredentialRecord,
  genesisPath,
  getBaseConfig,
} from './helpers'
import testLogger from './logger'

const faberConfig = getBaseConfig('Faber Credentials', {
  genesisPath,
})

const aliceConfig = getBaseConfig('Alice Credentials', {
  genesisPath,
})

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

  beforeAll(async () => {
    const faberMessages = new Subject()
    const aliceMessages = new Subject()

    faberAgent = new Agent(faberConfig)
    faberAgent.setInboundTransporter(new SubjectInboundTransporter(faberMessages, aliceMessages))
    faberAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages))
    await faberAgent.init()

    aliceAgent = new Agent(aliceConfig)
    aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages, faberMessages))
    aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(faberMessages))
    await aliceAgent.init()

    const schemaTemplate = {
      name: `test-schema-${Date.now()}`,
      attributes: ['name', 'age'],
      version: '1.0',
    }
    const schema = await registerSchema(faberAgent, schemaTemplate)

    const definitionTemplate = {
      schema,
      tag: 'TAG',
      signatureType: 'CL' as const,
      supportRevocation: false,
    }
    const credentialDefinition = await registerDefinition(faberAgent, definitionTemplate)
    credDefId = credentialDefinition.id

    const publicDid = faberAgent.publicDid?.did

    await ensurePublicDidIsOnLedger(faberAgent, publicDid!)
  })

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet()
    await aliceAgent.closeAndDeleteWallet()
  })

  test('Faber starts with connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')
    // eslint-disable-next-line prefer-const
    let { offer, credentialRecord: faberCredentialRecord } = await faberAgent.credentials.createOutOfBandOffer({
      preview: credentialPreview,
      credentialDefinitionId: credDefId,
      comment: 'some comment about credential',
    })

    const credentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    await aliceAgent.receiveMessage(offer.toJSON())

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await credentialRecordPromise

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
    })
  })
})
