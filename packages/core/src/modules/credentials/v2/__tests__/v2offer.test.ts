import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type { NegotiateOfferOptions, OfferCredentialOptions, ProposeCredentialOptions } from '../../interfaces'
import type { CredentialExchangeRecord } from '../CredentialExchangeRecord'
import type { Schema } from 'indy-sdk'

import { AutoAcceptCredential, CredentialState } from '../..'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../tests/helpers'
import testLogger from '../../../../../tests/logger'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { sleep } from '../../../../utils/sleep'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialRecord } from '../../repository'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { V2CredentialPreview } from '../V2CredentialPreview'

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let schema: Schema
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  // let faberCredentialRecord: CredentialRecord
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
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
    })
    const newCredentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
      lastname: 'Appleseed',
    })
    // ==============================
    // TESTS v1 BEGIN
    // ==========================
    test('Faber starts with credential offer to Alice, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      const schemaId = schema.id

      const credentialPreview = V2CredentialPreview.fromRecord({
        name: 'John',
        age: '99',
      })
      const offerOptions: OfferCredentialOptions = {
        comment: 'some comment about credential',
        connectionId: faberConnection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credDefId,
          },
        },
        protocolVersion: CredentialProtocolVersion.V1_0,
      }
      const faberCredentialExchangeRecord: CredentialExchangeRecord = await faberAgent.credentials.offerCredential(
        offerOptions
      )

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredentialRecord: CredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
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
