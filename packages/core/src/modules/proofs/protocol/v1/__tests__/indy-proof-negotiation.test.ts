import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { AcceptProofProposalOptions, NegotiateProofProposalOptions } from '../../../ProofsApiOptions'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { V1PresentationPreview } from '../models/V1PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage/didcomm'
import { AttributeFilter } from '../../../formats/indy/models/AttributeFilter'
import { PredicateType } from '../../../formats/indy/models/PredicateType'
import { ProofAttributeInfo } from '../../../formats/indy/models/ProofAttributeInfo'
import { ProofPredicateInfo } from '../../../formats/indy/models/ProofPredicateInfo'
import { ProofState } from '../../../models/ProofState'
import { V1ProposePresentationMessage, V1RequestPresentationMessage } from '../messages'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let aliceConnection: ConnectionRecord
  let presentationPreview: V1PresentationPreview
  let faberProofExchangeRecord: ProofExchangeRecord
  let aliceProofExchangeRecord: ProofExchangeRecord
  let didCommMessageRepository: DidCommMessageRepository

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, aliceConnection, presentationPreview } = await setupProofsTest(
      'Faber agent',
      'Alice agent'
    ))
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test(`Proof negotiation between Alice and Faber`, async () => {
    testLogger.test('Alice sends proof proposal to Faber')

    let faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          attributes: presentationPreview.attributes.filter((attribute) => attribute.name !== 'name'),
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V1 propose proof test 1',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    let proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test 1',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'image_0',
            credentialDefinitionId: presentationPreview.attributes[1].credentialDefinitionId,
          },
        ],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId: presentationPreview.predicates[0].credentialDefinitionId,
            predicate: '>=',
            threshold: 50,
          },
        ],
      },
    })
    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v1',
    })

    // Negotiate Proposal
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
      image_0: new ProofAttributeInfo({
        name: 'image_0',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const predicates = {
      age: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const requestProofAsResponseOptions: NegotiateProofProposalOptions = {
      proofRecordId: faberProofExchangeRecord.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    }

    let aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber sends new proof request to Alice')
    faberProofExchangeRecord = await faberAgent.proofs.negotiateProposal(requestProofAsResponseOptions)

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    let request = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/request-presentation',
      id: expect.any(String),
      requestAttachments: [
        {
          id: 'libindy-request-presentation-0',
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      thread: {
        threadId: faberProofExchangeRecord.threadId,
      },
    })
    expect(aliceProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: 'v1',
    })

    testLogger.test('Alice sends proof proposal to Faber')

    faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.negotiateRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          attributes: presentationPreview.attributes.filter((attribute) => attribute.name === 'name'),
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V1 propose proof test 2',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V1ProposePresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test 2',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'name',
            credentialDefinitionId: presentationPreview.attributes[0].credentialDefinitionId,
            value: 'John',
            referent: '0',
          },
        ],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId: presentationPreview.predicates[0].credentialDefinitionId,
            predicate: '>=',
            threshold: 50,
          },
        ],
      },
    })
    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v1',
    })

    // Accept Proposal
    const acceptProposalOptions: AcceptProofProposalOptions = {
      proofRecordId: faberProofExchangeRecord.id,
    }

    aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.proofs.acceptProposal(acceptProposalOptions)

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    request = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V1RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/request-presentation',
      id: expect.any(String),
      requestAttachments: [
        {
          id: 'libindy-request-presentation-0',
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      thread: {
        threadId: faberProofExchangeRecord.threadId,
      },
    })
    expect(aliceProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: 'v1',
    })

    const proposalMessage = await aliceAgent.proofs.findProposalMessage(aliceProofExchangeRecord.id)
    expect(proposalMessage).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      comment: 'V1 propose proof test 2',
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'name',
            credentialDefinitionId: presentationPreview.attributes[0].credentialDefinitionId,
            value: 'John',
            referent: '0',
          },
        ],
        predicates: [
          {
            name: 'age',
            credentialDefinitionId: presentationPreview.predicates[0].credentialDefinitionId,
            predicate: '>=',
            threshold: 50,
          },
        ],
      },
    })

    const proofRequestMessage = (await aliceAgent.proofs.findRequestMessage(
      aliceProofExchangeRecord.id
    )) as V1RequestPresentationMessage

    const predicateKey = Object.keys(proofRequestMessage.indyProofRequest?.requested_predicates ?? {})[0]
    expect(proofRequestMessage.indyProofRequest).toMatchObject({
      name: 'Proof Request',
      version: '1.0',
      requested_attributes: {
        '0': {
          name: 'name',
          restrictions: [
            {
              cred_def_id: credDefId,
            },
          ],
        },
      },
      requested_predicates: {
        [predicateKey]: {
          p_type: '>=',
          p_value: 50,
          restrictions: [
            {
              cred_def_id: credDefId,
            },
          ],
        },
      },
    })
  })
})
