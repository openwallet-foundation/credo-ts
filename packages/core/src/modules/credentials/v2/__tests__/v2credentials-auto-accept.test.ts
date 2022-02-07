import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../interfaces'
import type { Schema } from 'indy-sdk'

import { CredentialExchangeRecord, AutoAcceptCredential, CredentialState } from '../..'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../core/tests/helpers'
import { JsonTransformer } from '../../../../../src/utils/JsonTransformer'
import { sleep } from '../../../../../src/utils/sleep'
import testLogger from '../../../../../tests/logger'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialRecordType } from '../../interfaces'
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
  let aliceCredentialRecord: CredentialExchangeRecord
  const credentialPreview = V1CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
  })
  const newCredentialPreview = V1CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
    lastname: 'Appleseed',
  })

  const newV2CredentialPreview = V2CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
    lastname: 'Appleseed',
  })
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
    // ==============================
    // TESTS v2 BEGIN
    // ==========================
    test('Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      const schemaId = schema.id
      const proposeOptions: ProposeCredentialOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialFormats: {
          indy: {
            payload: {
              credentialPayload: {
                attributes: credentialPreview.attributes,
                schemaIssuerDid: faberAgent.publicDid?.did,
                schemaName: schema.name,
                schemaVersion: schema.version,
                schemaId: schema.id,
                issuerDid: faberAgent.publicDid?.did,
                credentialDefinitionId: credDefId,
              },
            },
          },
        },
        comment: 'v propose credential test',
      }
      const aliceCredentialExchangeRecord = await aliceAgent.credentials.proposeCredential(proposeOptions)
      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })
      testLogger.test('Faber waits for credential ack from Alice')
      aliceCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.Done,
      })
      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId,
              // credentialDefinitionId: credDefId, TMP FIX THIS MJR-TODO
            },
          },
        },
        state: CredentialState.Done,
      })
    })
    test('Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on `always`', async () => {
      testLogger.test('Faber sends V2 credential offer to Alice as start of protocol process')
      const schemaId = schema.id
      const credentialPreview = V2CredentialPreview.fromRecord({
        name: 'John',
        age: '99',
      })
      const offerOptions: OfferCredentialOptions = {
        comment: 'V2 Offer Credential',
        connectionId: faberConnection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credDefId,
          },
        },
        protocolVersion: CredentialProtocolVersion.V2_0,
      }
      const faberCredentialExchangeRecord: CredentialExchangeRecord = await faberAgent.credentials.offerCredential(
        offerOptions
      )
      testLogger.test('Alice waits for credential from Faber')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.OfferReceived,
      })
      // PUT THIS BACK WHEN WE ARE ABLE TO ISSUE CREDENTIALS MJR-TODO
      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })
      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredentialRecord: CredentialExchangeRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.Done,
      })
      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
            },
          },
        },
        state: CredentialState.Done,
      })
      expect(faberCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: CredentialState.Done,
      })
    })
  })

  describe('Auto accept on `contentApproved`', () => {
    beforeAll(async () => {
      ;({ faberAgent, aliceAgent, credDefId, schema, faberConnection, aliceConnection } = await setupCredentialTests(
        'faber agent: contentApproved',
        'alice agent: contentApproved',
        AutoAcceptCredential.ContentApproved
      ))
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })

    test('Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on `contentApproved`', async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      const schemaId = schema.id

      const proposeOptions: ProposeCredentialOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialFormats: {
          indy: {
            payload: {
              credentialPayload: {
                attributes: credentialPreview.attributes,
                schemaIssuerDid: faberAgent.publicDid?.did,
                schemaName: schema.name,
                schemaVersion: schema.version,
                schemaId: schema.id,
                issuerDid: faberAgent.publicDid?.did,
                credentialDefinitionId: credDefId,
              },
            },
          },
        },
        comment: 'v2 propose credential test',
      }
      const aliceCredentialExchangeRecord = await aliceAgent.credentials.proposeCredential(proposeOptions)

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      const options: AcceptProposalOptions = {
        connectionId: faberConnection.id,
        protocolVersion: aliceCredentialExchangeRecord.protocolVersion,
        credentialRecordId: faberCredentialRecord.id,
        comment: 'V2 Indy Offer',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credDefId,
          },
        },
      }
      const faberCredentialExchangeRecord = await faberAgent.credentials.acceptCredentialProposal(options)

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyRequest': expect.any(Object),
            '_internal/indyCredential': {
              schemaId,
            },
          },
        },
        state: CredentialState.Done,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {
          data: {
            '_internal/indyCredential': {
              schemaId,
            },
          },
        },
        state: CredentialState.Done,
      })
    })
    test('Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on `contentApproved`', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      const schemaId = schema.id

      const offerOptions: OfferCredentialOptions = {
        comment: 'some comment about credential',
        connectionId: faberConnection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credDefId,
          },
        },
        protocolVersion: CredentialProtocolVersion.V2_0,
      }
      const faberCredentialExchangeRecord = await faberAgent.credentials.offerCredential(offerOptions)

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.OfferReceived,
      })
      // expect(aliceCredentialRecord.offerMessage?.messageAttachment).toBeTruthy()
      // // console.log(">>>>>>>>>>>> aliceCredentialRecord = ", JsonTransformer.toJSON(aliceCredentialRecord))
      // expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
      //   createdAt: expect.any(Date),
      //   offerMessage: {
      //     '@id': expect.any(String),
      //     '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      //     credential_preview: {
      //       '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
      //       attributes: [
      //         {
      //           name: 'name',
      //           value: 'John',
      //         },
      //         {
      //           name: 'age',
      //           value: '99',
      //         },
      //       ],
      //     },
      //   },
      //   state: CredentialState.OfferReceived,
      // })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)

      if (aliceCredentialRecord.connectionId) {
        const acceptOfferOptions: AcceptOfferOptions = {
          credentialRecordId: aliceCredentialRecord.id,
          connectionId: aliceCredentialRecord.connectionId,
          credentialRecordType: CredentialRecordType.Indy,
          protocolVersion: CredentialProtocolVersion.V2_0,
        }
        testLogger.test('Alice sends credential request to faber')
        const faberCredentialExchangeRecord: CredentialExchangeRecord =
          await aliceAgent.credentials.acceptCredentialOffer(acceptOfferOptions)

        testLogger.test('Alice waits for credential from Faber')
        aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
          threadId: faberCredentialExchangeRecord.threadId,
          state: CredentialState.CredentialReceived,
        })

        testLogger.test('Faber waits for credential ack from Alice')
        const faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
          threadId: faberCredentialExchangeRecord.threadId,
          state: CredentialState.Done,
        })

        expect(aliceCredentialRecord).toMatchObject({
          type: CredentialExchangeRecord.name,
          id: expect.any(String),
          createdAt: expect.any(Date),
          metadata: {
            data: {
              '_internal/indyRequest': expect.any(Object),
              '_internal/indyCredential': {
                schemaId,
              },
            },
          },
          state: CredentialState.Done,
        })

        expect(faberCredentialRecord).toMatchObject({
          type: CredentialExchangeRecord.name,
          id: expect.any(String),
          createdAt: expect.any(Date),
          state: CredentialState.Done,
        })
      } else {
        throw Error('missing alice connection id')
      }
    })
    test('Alice starts with V2 credential proposal to Faber, both have autoAcceptCredential on `contentApproved` and attributes did change', async () => {
      const proposeOptions: ProposeCredentialOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialFormats: {
          indy: {
            payload: {
              credentialPayload: {
                attributes: credentialPreview.attributes,
                schemaIssuerDid: faberAgent.publicDid?.did,
                schemaName: schema.name,
                schemaVersion: schema.version,
                schemaId: schema.id,
                issuerDid: faberAgent.publicDid?.did,
                credentialDefinitionId: credDefId,
              },
            },
          },
        },
        comment: 'v2 propose credential test',
      }
      testLogger.test('Alice sends credential proposal to Faber')
      const aliceCredentialExchangeRecord = await aliceAgent.credentials.proposeCredential(proposeOptions)

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: CredentialState.ProposalReceived,
      })

      const negotiateOptions: NegotiateProposalOptions = {
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialRecordId: faberCredentialRecord.id,
        credentialFormats: {
          indy: {
            credentialDefinitionId: credDefId,
            attributes: newCredentialPreview.attributes,
          },
        },
      }
      const faberCredentialExchangeRecord = await faberAgent.credentials.negotiateCredentialProposal(negotiateOptions)

      testLogger.test('Alice waits for credential offer from Faber')

      const record = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.OfferReceived,
      })
      // expect(record.offerMessage?.messageAttachment).toBeTruthy()
      // expect(JsonTransformer.toJSON(record)).toMatchObject({
      //   createdAt: expect.any(Date),
      //   offerMessage: {
      //     '@id': expect.any(String),
      //     '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      //     credential_preview: {
      //       '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
      //       attributes: [
      //         {
      //           name: 'name',
      //           value: 'John',
      //         },
      //         {
      //           name: 'age',
      //           value: '99',
      //         },
      //         {
      //           name: 'lastname',
      //           value: 'Appleseed',
      //         },
      //       ],
      //     },
      //   },
      //   state: CredentialState.OfferReceived,
      // })

      // below values are not in json object
      expect(record.id).not.toBeNull()
      expect(record.getTags()).toEqual({
        threadId: record.threadId,
        state: record.state,
        connectionId: aliceConnection.id,
      })
      expect(record.type).toBe(CredentialExchangeRecord.name)

      // Check if the state of the credential records did not change
      faberCredentialRecord = await faberAgent.credentials.OLDgetById(faberCredentialRecord.id)
      faberCredentialRecord.assertState(CredentialState.OfferSent)

      const aliceRecord = await aliceAgent.credentials.OLDgetById(record.id)
      aliceRecord.assertState(CredentialState.OfferReceived)
    })
    test('Faber starts with V2 credential offer to Alice, both have autoAcceptCredential on `contentApproved` and attributes did change', async () => {
      testLogger.test('Faber sends credential offer to Alice')
      const offerOptions: OfferCredentialOptions = {
        comment: 'some comment about credential',
        connectionId: faberConnection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: credDefId,
          },
        },
        protocolVersion: CredentialProtocolVersion.V2_0,
      }
      const faberCredentialExchangeRecord = await faberAgent.credentials.offerCredential(offerOptions)

      testLogger.test('Alice waits for credential offer from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: CredentialState.OfferReceived,
      })
      // expect(aliceCredentialRecord.offerMessage?.messageAttachment).toBeTruthy()
      // expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
      //   createdAt: expect.any(Date),
      //   offerMessage: {
      //     '@id': expect.any(String),
      //     '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      //     credential_preview: {
      //       '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
      //       attributes: [
      //         {
      //           name: 'name',
      //           value: 'John',
      //         },
      //         {
      //           name: 'age',
      //           value: '99',
      //         },
      //       ],
      //     },
      //   },
      //   state: CredentialState.OfferReceived,
      // })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnection.id,
      })
      expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)

      testLogger.test('Alice sends credential request to Faber')
      const proposeOptions: ProposeCredentialOptions = {
        connectionId: aliceConnection.id,
        protocolVersion: CredentialProtocolVersion.V2_0,
        credentialRecordId: aliceCredentialRecord.id,
        credentialFormats: {
          indy: {
            payload: {
              credentialPayload: {
                attributes: newCredentialPreview.attributes,
                credentialDefinitionId: credDefId,
              },
            },
          },
        },
        comment: 'v2 propose credential test',
      }
      await sleep(5000)

      const aliceExchangeCredentialRecord = await aliceAgent.credentials.negotiateCredentialOffer(proposeOptions)

      testLogger.test('Faber waits for credential proposal from Alice')
      const faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceExchangeCredentialRecord.threadId,
        state: CredentialState.ProposalReceived,
      })
      // expect(faberCredentialRecord.offerMessage?.messageAttachment).toBeTruthy()
      // expect(JsonTransformer.toJSON(faberCredentialRecord)).toMatchObject({
      //   createdAt: expect.any(Date),
      //   proposalMessage: {
      //     '@type': 'https://didcomm.org/issue-credential/2.0/propose-credential',
      //     '@id': expect.any(String),
      //     credential_proposal: {
      //       '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
      //       attributes: [
      //         {
      //           name: 'name',
      //           value: 'John',
      //         },
      //         {
      //           name: 'age',
      //           value: '99',
      //         },
      //         {
      //           name: 'lastname',
      //           value: 'Appleseed',
      //         },
      //       ],
      //     },
      //     '~thread': { thid: expect.any(String) },
      //   },
      //   state: CredentialState.ProposalReceived,
      // })

      // Check if the state of fabers credential record did not change
      const faberRecord = await faberAgent.credentials.getById(faberCredentialRecord.id)
      faberRecord.assertState(CredentialState.ProposalReceived)

      aliceCredentialRecord = await aliceAgent.credentials.getById(aliceCredentialRecord.id)
      aliceCredentialRecord.assertState(CredentialState.ProposalSent)
    })
  })
})
