import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../connections'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../interfaces'
import type { CredPropose } from '../formats/CredentialFormatService'

import { CredentialExchangeRecord, CredentialState } from '../..'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../core/tests/helpers'
import { unitTestLogger } from '../../../../../src/logger'
import testLogger from '../../../../../tests/logger'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialRecordType } from '../../interfaces'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord

  const credentialPreview = V1CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
  })
  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection } = await setupCredentialTests(
      'Faber Agent Credentials',
      'Alice Agent Credential'
    ))
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })
  const testAttributes = {
    attributes: credentialPreview.attributes,
    schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    schemaName: 'ahoy',
    schemaVersion: '1.0',
    schemaId: '1560364003',
    issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    credentialDefinitionId: 'GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag',
    linkedAttachments: [
      new LinkedAttachment({
        name: 'profile_picture',
        attachment: new Attachment({
          mimeType: 'image/png',
          data: new AttachmentData({ base64: 'base64encodedpic' }),
        }),
      }),
    ],
  }
  // ==============================
  // TEST v1 BEGIN
  // ==========================
  test('Alice starts with V1 credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v1) credential proposal to Faber')
    // set the propose options
    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V1_0,
      credentialFormats: {
        indy: {
          payload: {
            credentialPayload: testAttributes,
          },
        },
      },
      comment: 'v1 propose credential test',
    }

    const credPropose: CredPropose = proposeOptions.credentialFormats.indy?.payload as CredPropose
    unitTestLogger('ProposeCredentialOptions indy proposeOptions attributes = ', credPropose.attributes)

    const credentialExchangeRecord = await aliceAgent.credentials.proposeCredential(proposeOptions)

    expect(credentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(credentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V1_0)
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()
    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    const options: AcceptProposalOptions = {
      connectionId: faberConnection.id,
      protocolVersion: credentialExchangeRecord.protocolVersion,
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V1 Indy Proposal',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
    }

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptCredentialProposal(options)

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    // expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
    //   createdAt: expect.any(Date),
    //   offerMessage: {
    //     '@id': expect.any(String),
    //     '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
    //     comment: 'V1 Indy Proposal',
    //     credential_preview: {
    //       '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
    //       attributes: [
    //         {
    //           name: 'name',
    //           'mime-type': 'text/plain',
    //           value: 'John',
    //         },
    //         {
    //           name: 'age',
    //           'mime-type': 'text/plain',
    //           value: '99',
    //         },
    //         {
    //           name: 'profile_picture',
    //           'mime-type': 'image/png',
    //           value: 'hl:zQmcKEWE6eZWpVqGKhbmhd8SxWBa9fgLX7aYW8RJzeHQMZg',
    //         },
    //       ],
    //     },
    //     'offers~attach': expect.any(Array),
    //   },
    //   state: CredentialState.OfferReceived,
    // })
    // below values are not in json object
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
    })
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)
    if (aliceCredentialRecord.connectionId) {
      const acceptOfferOptions: AcceptOfferOptions = {
        credentialRecordId: aliceCredentialRecord.id,
        connectionId: aliceCredentialRecord.connectionId,
        credentialRecordType: CredentialRecordType.Indy,
        protocolVersion: CredentialProtocolVersion.V1_0,
      }
      const offerCredentialExchangeRecord: CredentialExchangeRecord =
        await aliceAgent.credentials.acceptCredentialOffer(acceptOfferOptions)

      expect(offerCredentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
      expect(offerCredentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V1_0)
      expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
      expect(offerCredentialExchangeRecord.threadId).not.toBeNull()
      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      const options: AcceptRequestOptions = {
        protocolVersion: offerCredentialExchangeRecord.protocolVersion,
        credentialRecordId: faberCredentialRecord.id,
        comment: 'V1 Indy Credential',
      }
      testLogger.test('Faber sends credential to Alice')
      await faberAgent.credentials.acceptCredentialRequest(options)

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })
    } else {
      throw Error('Missing Connection Id')
    }
  })
  // ==============================
  // TEST v1 END
  // ==========================

  // -------------------------- V2 TEST BEGIN --------------------------------------------

  test('Alice starts with V2 (Indy format) credential proposal to Faber', async () => {
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
    })
    testLogger.test('Alice sends (v2) credential proposal to Faber')
    // set the propose options
    // we should set the version to V1.0 and V2.0 in separate tests, one as a regression test
    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V2_0,
      credentialFormats: {
        indy: {
          payload: {
            credentialPayload: testAttributes,
          },
        },
      },
      comment: 'v2 propose credential test',
    }
    testLogger.test('Alice sends (v2, Indy) credential proposal to Faber')

    const credentialExchangeRecord: CredentialExchangeRecord = await aliceAgent.credentials.proposeCredential(
      proposeOptions
    )

    expect(credentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(credentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2_0)
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    const options: AcceptProposalOptions = {
      connectionId: faberConnection.id,
      protocolVersion: credentialExchangeRecord.protocolVersion,
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Offer',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
    }
    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptCredentialProposal(options)

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    // MJR-TODO how do we get the offer message out of the didcomm message repository from inside tests??
    // if (aliceCredentialRecord.offerMessage) {
    // expect(aliceCredentialRecord.offerMessage?.messageAttachment).toBeTruthy
    // expect(JsonTransformer.toJSON(aliceCredentialRecord)).toMatchObject({
    //   createdAt: expect.any(Date),
    //   offerMessage: {
    //     // '@id': expect.any(String), MJR-TODO fix this
    //     '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
    //     comment: 'V2 Indy Offer',
    //     credential_preview: {
    //       '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
    //       attributes: [
    //         {
    //           name: 'name',
    //           'mime-type': 'text/plain',
    //           value: 'John',
    //         },
    //         {
    //           name: 'age',
    //           'mime-type': 'text/plain',
    //           value: '99',
    //         },
    //         {
    //           name: 'profile_picture',
    //           'mime-type': 'image/png',
    //           value: 'hl:zQmcKEWE6eZWpVqGKhbmhd8SxWBa9fgLX7aYW8RJzeHQMZg',
    //         },
    //       ],
    //     },
    //     // 'offers~attach': expect.any(Array), MJR-TODO fix this
    //   },
    //   state: CredentialState.OfferReceived,
    // })
    // expect(aliceCredentialRecord.offerMessage?.id).toBeTruthy
    // }
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
    })
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)

    if (aliceCredentialRecord.connectionId) {
      const acceptOfferOptions: AcceptOfferOptions = {
        credentialRecordId: aliceCredentialRecord.id,
        connectionId: aliceCredentialRecord.connectionId,
        credentialRecordType: CredentialRecordType.Indy,
        protocolVersion: CredentialProtocolVersion.V2_0,
      }
      const offerCredentialExchangeRecord: CredentialExchangeRecord =
        await aliceAgent.credentials.acceptCredentialOffer(acceptOfferOptions)

      expect(offerCredentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
      expect(offerCredentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2_0)
      expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
      expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

      testLogger.test('Faber waits for credential request from Alice')
      await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Faber sends credential to Alice')
      const options: AcceptRequestOptions = {
        protocolVersion: credentialExchangeRecord.protocolVersion,
        credentialRecordId: faberCredentialRecord.id,
        comment: 'V2 Indy Credential',
      }
      await faberAgent.credentials.acceptCredentialRequest(options)

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      // testLogger.test('Alice sends credential ack to Faber')
      await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id, CredentialProtocolVersion.V2_0)

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })
      expect(aliceCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: expect.any(String),
        connectionId: expect.any(String),
        credentialId: expect.any(String),
        state: CredentialState.CredentialReceived,
      })
    } else {
      throw Error('Missing Connection Id')
    }
  })
  test('Feber starts with V2 offer; Alice declines', async () => {
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
    // below values are not in json object
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: aliceCredentialRecord.threadId,
      state: aliceCredentialRecord.state,
      connectionId: aliceConnection.id,
    })
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)
    testLogger.test('Alice declines offer')
    if (aliceCredentialRecord.id) {
      await aliceAgent.credentials.declineCredentialOffer(aliceCredentialRecord.id, CredentialProtocolVersion.V2_0)
    } else {
      throw Error('Missing credential record id')
    }
  })
})
// -------------------------- V2 TEST END --------------------------------------------
