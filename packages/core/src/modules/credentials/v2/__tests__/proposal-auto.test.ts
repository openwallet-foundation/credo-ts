import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type { Schema } from 'indy-sdk'

import { AutoAcceptCredential, CredentialRecord, CredentialState } from '../..'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../tests/helpers'
import testLogger from '../../../../../tests/logger'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { sleep } from '../../../../utils/sleep'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const newCredentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
  lastname: 'Appleseed',
})

describe('auto accept credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let schema: Schema
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let faberCredentialRecord: CredentialRecord
  let aliceCredentialRecord: CredentialRecord

  describe('Auto accept on `always`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, schema, faberConnection, aliceConnection } = await setupCredentialTests(
        'faber agent: always',
        'alice agent: always',
        AutoAcceptCredential.Always
      ))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test('Alice starts with credential proposal to Faber, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Alice sends credential proposal to Faber')

      const schemaId = schema.id
      let aliceCredentialRecord = await aliceAgent.credentials.OLDproposeCredential(aliceConnection.id, {
        credentialProposal: credentialPreview,
        credentialDefinitionId: credDefId,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        metadata: {
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credDefId,
            },
          },
        },
        credentialId: expect.any(String),
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credDefId,
            },
          },
        },
        offerMessage: expect.any(Object),
        requestMessage: expect.any(Object),
        state: CredentialState.Done,
      })
    })

    test('Faber starts with credential offer to Alice, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      const schemaId = schema.id
      faberCredentialRecord = await faberAgent.credentials.OLDofferCredential(faberConnection.id, {
        preview: credentialPreview,
        credentialDefinitionId: credDefId,
        comment: 'some comment about credential',
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
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
              credentialDefinitionId: credDefId,
            },
          },
        },
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
})
