import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections/repository/ConnectionRecord'
import type { AcceptProofProposalOptions } from '../../../ProofsApiOptions'
import type { ProofExchangeRecord } from '../../../repository/ProofExchangeRecord'
import type { V1PresentationPreview } from '../../v1/models/V1PresentationPreview'
import type { CredDefId } from 'indy-sdk'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage/didcomm'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { AttributeFilter } from '../../../formats/indy/models/AttributeFilter'
import { PredicateType } from '../../../formats/indy/models/PredicateType'
import { ProofAttributeInfo } from '../../../formats/indy/models/ProofAttributeInfo'
import { ProofPredicateInfo } from '../../../formats/indy/models/ProofPredicateInfo'
import { ProofRequest } from '../../../formats/indy/models/ProofRequest'
import { ProofState } from '../../../models/ProofState'
import { V2ProposePresentationMessage, V2RequestPresentationMessage } from '../messages'

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
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          attributes: presentationPreview.attributes.filter((attribute) => attribute.name !== 'name'),
          predicates: presentationPreview.predicates,
        },
      },
      comment: 'V2 propose proof test 1',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    let proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V2ProposePresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      proposalAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 propose proof test 1',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let proposalAttach = proposal?.proposalAttachments[0].getDataAsJson() as any
    let attributesGroup = Object.keys(proposalAttach.requested_attributes ?? {})[0]
    let predicatesGroup = Object.keys(proposalAttach.requested_predicates ?? {})[0]
    expect(proposalAttach).toMatchObject({
      requested_attributes: {
        [attributesGroup]: {
          name: 'image_0',
          restrictions: [
            {
              cred_def_id: presentationPreview.attributes[1].credentialDefinitionId,
            },
          ],
        },
      },
      requested_predicates: {
        [predicatesGroup]: {
          name: 'age',
          p_type: '>=',
          p_value: 50,
          restrictions: [
            {
              cred_def_id: presentationPreview.predicates[0].credentialDefinitionId,
            },
          ],
        },
      },
    })
    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v2',
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

    let aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Faber sends new proof request to Alice')
    faberProofExchangeRecord = await faberAgent.proofs.negotiateProposal({
      proofRecordId: faberProofExchangeRecord.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    testLogger.test('Alice waits for proof request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    let request = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V2RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      id: expect.any(String),
      requestAttachments: [
        {
          id: expect.any(String),
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
      protocolVersion: 'v2',
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
      comment: 'V2 propose proof test 2',
    })

    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    didCommMessageRepository = faberAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    proposal = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberProofExchangeRecord.id,
      messageClass: V2ProposePresentationMessage,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      proposalAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 propose proof test 2',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proposalAttach = proposal?.proposalAttachments[0].getDataAsJson() as any
    attributesGroup = Object.keys(proposalAttach.requested_attributes ?? {})[0]
    predicatesGroup = Object.keys(proposalAttach.requested_predicates ?? {})[0]
    expect(proposalAttach).toMatchObject({
      requested_attributes: {
        [attributesGroup]: {
          name: 'name',
          restrictions: [
            {
              cred_def_id: presentationPreview.attributes[1].credentialDefinitionId,
            },
          ],
        },
      },
      requested_predicates: {
        [predicatesGroup]: {
          name: 'age',
          p_type: '>=',
          p_value: 50,
          restrictions: [
            {
              cred_def_id: presentationPreview.predicates[0].credentialDefinitionId,
            },
          ],
        },
      },
    })
    expect(faberProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v2',
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
      messageClass: V2RequestPresentationMessage,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      requestAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: faberProofExchangeRecord.threadId,
      },
    })
    expect(aliceProofExchangeRecord).toMatchObject({
      id: expect.anything(),
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: 'v2',
    })

    const proposalMessage = await aliceAgent.proofs.findProposalMessage(aliceProofExchangeRecord.id)

    expect(proposalMessage).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'hlindy/proof-req@v2.0',
        },
      ],
      proposalAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 propose proof test 2',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proposalAttach = proposal?.proposalAttachments[0].getDataAsJson() as any
    attributesGroup = Object.keys(proposalAttach.requested_attributes ?? {})[0]
    predicatesGroup = Object.keys(proposalAttach.requested_predicates ?? {})[0]
    expect(proposalAttach).toMatchObject({
      requested_attributes: {
        [attributesGroup]: {
          name: 'name',
          restrictions: [
            {
              cred_def_id: presentationPreview.attributes[1].credentialDefinitionId,
            },
          ],
        },
      },
      requested_predicates: {
        [predicatesGroup]: {
          name: 'age',
          p_type: '>=',
          p_value: 50,
          restrictions: [
            {
              cred_def_id: presentationPreview.predicates[0].credentialDefinitionId,
            },
          ],
        },
      },
    })

    const proofRequestMessage = (await aliceAgent.proofs.findRequestMessage(
      aliceProofExchangeRecord.id
    )) as V2RequestPresentationMessage

    const proofRequest = JsonTransformer.fromJSON(
      proofRequestMessage.requestAttachments[0].getDataAsJson(),
      ProofRequest
    )
    const predicateKey = proofRequest.requestedPredicates?.keys().next().value

    expect(proofRequest.toJSON()).toMatchObject({
      name: 'proof-request',
      nonce: expect.any(String),
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
          name: 'age',
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
