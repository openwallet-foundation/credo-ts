import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'

import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import { JsonTransformer } from '../../../../../utils'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import {
  V1ProposeCredentialMessage,
  V1RequestCredentialMessage,
  V1IssueCredentialMessage,
  V1OfferCredentialMessage,
  V1CredentialPreview,
} from '../messages'

describe('v1 credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord

  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, credDefId, aliceConnection } = await setupCredentialTests(
      'Faber Agent Credentials v1',
      'Alice Agent Credentials v1'
    ))
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with V1 credential proposal to Faber', async () => {
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
      'x-ray': 'some x-ray',
      profile_picture: 'profile picture',
    })

    testLogger.test('Alice sends (v1) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.credentials.proposeCredential({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
          schemaName: 'ahoy',
          schemaVersion: '1.0',
          schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
          issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
          credentialDefinitionId: 'GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag',
        },
      },
      comment: 'v1 propose credential test',
    })

    expect(credentialExchangeRecord).toMatchObject({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      state: CredentialState.ProposalSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptProposal({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V1 Indy Proposal',
      credentialFormats: {
        indy: {
          credentialDefinitionId: credDefId,
          attributes: credentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    const didCommMessageRepository = faberAgent.dependencyManager.resolve(DidCommMessageRepository)
    const offerMessageRecord = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberCredentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    expect(JsonTransformer.toJSON(offerMessageRecord)).toMatchObject({
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
            name: 'x-ray',
            'mime-type': 'text/plain',
            value: 'some x-ray',
          },
          {
            name: 'profile_picture',
            'mime-type': 'text/plain',
            value: 'profile picture',
          },
        ],
      },
      'offers~attach': expect.any(Array),
    })

    expect(aliceCredentialRecord).toMatchObject({
      id: expect.any(String),
      connectionId: expect.any(String),
      type: CredentialExchangeRecord.type,
    })

    // below values are not in json object
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
      credentialIds: [],
    })

    const offerCredentialExchangeRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      state: CredentialState.RequestSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    await faberAgent.credentials.acceptRequest({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V1 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    await aliceAgent.credentials.acceptCredential({
      credentialRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for state done')
    await waitForCredentialRecord(faberAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    const proposalMessage = await aliceAgent.credentials.findProposalMessage(aliceCredentialRecord.id)
    const offerMessage = await aliceAgent.credentials.findOfferMessage(aliceCredentialRecord.id)
    const requestMessage = await aliceAgent.credentials.findRequestMessage(aliceCredentialRecord.id)
    const credentialMessage = await aliceAgent.credentials.findCredentialMessage(aliceCredentialRecord.id)

    expect(proposalMessage).toBeInstanceOf(V1ProposeCredentialMessage)
    expect(offerMessage).toBeInstanceOf(V1OfferCredentialMessage)
    expect(requestMessage).toBeInstanceOf(V1RequestCredentialMessage)
    expect(credentialMessage).toBeInstanceOf(V1IssueCredentialMessage)

    const formatData = await aliceAgent.credentials.getFormatData(aliceCredentialRecord.id)
    expect(formatData).toMatchObject({
      proposalAttributes: [
        {
          name: 'name',
          mimeType: 'text/plain',
          value: 'John',
        },
        {
          name: 'age',
          mimeType: 'text/plain',
          value: '99',
        },
        {
          name: 'x-ray',
          mimeType: 'text/plain',
          value: 'some x-ray',
        },
        {
          name: 'profile_picture',
          mimeType: 'text/plain',
          value: 'profile picture',
        },
      ],
      proposal: {
        indy: {
          schema_issuer_did: expect.any(String),
          schema_id: expect.any(String),
          schema_name: expect.any(String),
          schema_version: expect.any(String),
          cred_def_id: expect.any(String),
          issuer_did: expect.any(String),
        },
      },
      offer: {
        indy: {
          schema_id: expect.any(String),
          cred_def_id: expect.any(String),
          key_correctness_proof: expect.any(Object),
          nonce: expect.any(String),
        },
      },
      offerAttributes: [
        {
          name: 'name',
          mimeType: 'text/plain',
          value: 'John',
        },
        {
          name: 'age',
          mimeType: 'text/plain',
          value: '99',
        },
        {
          name: 'x-ray',
          mimeType: 'text/plain',
          value: 'some x-ray',
        },
        {
          name: 'profile_picture',
          mimeType: 'text/plain',
          value: 'profile picture',
        },
      ],
      request: {
        indy: {
          prover_did: expect.any(String),
          cred_def_id: expect.any(String),
          blinded_ms: expect.any(Object),
          blinded_ms_correctness_proof: expect.any(Object),
          nonce: expect.any(String),
        },
      },
      credential: {
        indy: {
          schema_id: expect.any(String),
          cred_def_id: expect.any(String),
          rev_reg_id: null,
          values: {
            age: { raw: '99', encoded: '99' },
            profile_picture: {
              raw: 'profile picture',
              encoded: '28661874965215723474150257281172102867522547934697168414362313592277831163345',
            },
            name: {
              raw: 'John',
              encoded: '76355713903561865866741292988746191972523015098789458240077478826513114743258',
            },
            'x-ray': {
              raw: 'some x-ray',
              encoded: '43715611391396952879378357808399363551139229809726238083934532929974486114650',
            },
          },
          signature: expect.any(Object),
          signature_correctness_proof: expect.any(Object),
          rev_reg: null,
          witness: null,
        },
      },
    })
  })
})
