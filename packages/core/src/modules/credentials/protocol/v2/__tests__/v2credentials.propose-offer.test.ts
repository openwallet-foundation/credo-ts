import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { ServiceAcceptOfferOptions } from '../../../CredentialServiceOptions'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../../interfaces'

import { AriesFrameworkError } from '../../../../../../src/error/AriesFrameworkError'
import { DidCommMessageRepository } from '../../../../../../src/storage'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../../../utils'
import { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialState } from '../../../CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { V1OfferCredentialMessage } from '../../v1/messages/V1OfferCredentialMessage'
import { V2CredentialPreview } from '../V2CredentialPreview'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord

  let didCommMessageRepository: DidCommMessageRepository
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
  // ==============================
  // TEST v1 BEGIN
  // ==========================
  test('Alice starts with V1 credential proposal to Faber', async () => {
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
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
    testLogger.test('Alice sends (v1) credential proposal to Faber')
    // set the propose options
    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V1,
      credentialFormats: {
        indy: {
          payload: {
            credentialPayload: testAttributes,
          },
        },
      },
      comment: 'v1 propose credential test',
    }

    const credentialExchangeRecord = await aliceAgent.credentials.proposeCredential(proposeOptions)

    expect(credentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(credentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V1)
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()
    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    const options: AcceptProposalOptions = {
      connectionId: faberConnection.id,
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

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberCredentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@id': expect.any(String),
      '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
      comment: 'V1 Indy Proposal',
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
      'offers~attach': expect.any(Array),
    })
    // below values are not in json object
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
      credentialIds: [],
    })
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)
    if (aliceCredentialRecord.connectionId) {
      const acceptOfferOptions: AcceptOfferOptions = {
        credentialRecordId: aliceCredentialRecord.id,
      }
      const offerCredentialExchangeRecord: CredentialExchangeRecord =
        await aliceAgent.credentials.acceptCredentialOffer(acceptOfferOptions)

      expect(offerCredentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
      expect(offerCredentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V1)
      expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
      expect(offerCredentialExchangeRecord.threadId).not.toBeNull()
      testLogger.test('Faber waits for credential request from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      const options: AcceptRequestOptions = {
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
      throw new AriesFrameworkError('Missing Connection Id')
    }
  })
  // ==============================
  // TEST v1 END
  // ==========================

  // -------------------------- V2 TEST BEGIN --------------------------------------------

  test('Alice starts with V2 (Indy format) credential proposal to Faber', async () => {
    const credentialPreview = V2CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
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
    testLogger.test('Alice sends (v2) credential proposal to Faber')
    // set the propose options
    // we should set the version to V1.0 and V2.0 in separate tests, one as a regression test
    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V2,
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
    expect(credentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2)
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    const options: AcceptProposalOptions = {
      connectionId: faberConnection.id,
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

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberCredentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      comment: 'V2 Indy Offer',
      credential_preview: {
        '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
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
    })
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: faberCredentialRecord.threadId,
      credentialIds: [],
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
    })
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)

    if (aliceCredentialRecord.connectionId) {
      const acceptOfferOptions: ServiceAcceptOfferOptions = {
        credentialRecordId: aliceCredentialRecord.id,
        credentialFormats: {
          indy: undefined,
          w3c: undefined,
        },
      }
      const offerCredentialExchangeRecord: CredentialExchangeRecord =
        await aliceAgent.credentials.acceptCredentialOffer(acceptOfferOptions)

      expect(offerCredentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
      expect(offerCredentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2)
      expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
      expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

      testLogger.test('Faber waits for credential request from Alice')
      await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Faber sends credential to Alice')

      const options: AcceptRequestOptions = {
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
      await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id, CredentialProtocolVersion.V2)

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
        state: CredentialState.CredentialReceived,
      })
    } else {
      throw new AriesFrameworkError('Missing Connection Id')
    }
  })
  test('Faber starts with V2 offer; Alice declines', async () => {
    testLogger.test('Faber sends credential offer to Alice')
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
      protocolVersion: CredentialProtocolVersion.V2,
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
      credentialIds: [],
    })
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)
    testLogger.test('Alice declines offer')
    if (aliceCredentialRecord.id) {
      await aliceAgent.credentials.declineCredentialOffer(aliceCredentialRecord.id, CredentialProtocolVersion.V2)
    } else {
      throw new AriesFrameworkError('Missing credential record id')
    }
  })
})
// -------------------------- V2 TEST END --------------------------------------------
