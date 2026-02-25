import { JsonTransformer } from '@credo-ts/core'
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommMessageRepository,
} from '@credo-ts/didcomm'
import { waitForCredentialRecord } from '../../../../../../core/tests/helpers'
import testLogger from '../../../../../../core/tests/logger'
import type { AnonCredsTestsAgent } from '../../../../../tests/legacyAnonCredsSetup'
import { setupAnonCredsTests } from '../../../../../tests/legacyAnonCredsSetup'
import {
  DidCommCredentialV1Preview,
  DidCommIssueCredentialV1Message,
  DidCommProposeCredentialV1Message,
  DidCommRequestCredentialV1Message,
  V1OfferCredentialMessage,
} from '../messages'

describe('V1 Credentials', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let credentialDefinitionId: string
  let aliceConnectionId: string

  beforeAll(async () => {
    ;({
      issuerAgent: faberAgent,
      holderAgent: aliceAgent,
      credentialDefinitionId,
      holderIssuerConnectionId: aliceConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber Agent Credentials V1',
      holderName: 'Alice Agent Credentials V1',
      attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
    }))
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Alice starts with V1 credential proposal to Faber', async () => {
    const credentialPreview = DidCommCredentialV1Preview.fromRecord({
      name: 'John',
      age: '99',
      'x-ray': 'some x-ray',
      profile_picture: 'profile picture',
    })

    testLogger.test('Alice sends (v1) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.didcomm.credentials.proposeCredential({
      connectionId: aliceConnectionId,
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
      connectionId: aliceConnectionId,
      protocolVersion: 'v1',
      state: DidCommCredentialState.ProposalSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.didcomm.credentials.acceptProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V1 Indy Proposal',
      credentialFormats: {
        indy: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: credentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
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
      type: DidCommCredentialExchangeRecord.type,
    })

    // below values are not in json object
    expect(aliceCredentialRecord.getTags()).toEqual({
      role: DidCommCredentialRole.Holder,
      parentThreadId: undefined,
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
      credentialIds: [],
    })

    const offerCredentialExchangeRecord = await aliceAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnectionId,
      protocolVersion: 'v1',
      state: DidCommCredentialState.RequestSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    await faberAgent.didcomm.credentials.acceptRequest({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V1 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })

    await aliceAgent.didcomm.credentials.acceptCredential({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for state done')
    await waitForCredentialRecord(faberAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })

    const proposalMessage = await aliceAgent.didcomm.credentials.findProposalMessage(aliceCredentialRecord.id)
    const offerMessage = await aliceAgent.didcomm.credentials.findOfferMessage(aliceCredentialRecord.id)
    const requestMessage = await aliceAgent.didcomm.credentials.findRequestMessage(aliceCredentialRecord.id)
    const credentialMessage = await aliceAgent.didcomm.credentials.findCredentialMessage(aliceCredentialRecord.id)

    expect(proposalMessage).toBeInstanceOf(DidCommProposeCredentialV1Message)
    expect(offerMessage).toBeInstanceOf(V1OfferCredentialMessage)
    expect(requestMessage).toBeInstanceOf(DidCommRequestCredentialV1Message)
    expect(credentialMessage).toBeInstanceOf(DidCommIssueCredentialV1Message)

    const formatData = await aliceAgent.didcomm.credentials.getFormatData(aliceCredentialRecord.id)
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
