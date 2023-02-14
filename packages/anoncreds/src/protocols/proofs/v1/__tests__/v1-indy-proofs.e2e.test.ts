import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { V1PresentationPreview } from '../models'

import { setupProofsTest, waitForProofExchangeRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { getGroupKeysFromIndyProofFormatData } from '../../../formats/indy/__tests__/groupKeys'
import { ProofAttributeInfo, AttributeFilter, ProofPredicateInfo, PredicateType } from '../../../formats/indy/models'
import { ProofState } from '../../../models'
import { ProofExchangeRecord } from '../../../repository'
import { V1ProposePresentationMessage, V1RequestPresentationMessage, V1PresentationMessage } from '../messages'

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let faberProofExchangeRecord: ProofExchangeRecord
  let aliceProofExchangeRecord: ProofExchangeRecord
  let presentationPreview: V1PresentationPreview

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
      await setupProofsTest('Faber agent v1', 'Alice agent v1'))
    testLogger.test('Issuing second credential')
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with proof proposal to Faber', async () => {
    // Alice sends a presentation proposal to Faber
    testLogger.test('Alice sends a presentation proposal to Faber')

    let faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      state: ProofState.ProposalReceived,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.proposeProof({
      connectionId: aliceConnection.id,
      protocolVersion: 'v1',
      proofFormats: {
        indy: {
          attributes: presentationPreview.attributes,
          predicates: presentationPreview.predicates,
        },
      },
    })

    // Faber waits for a presentation proposal from Alice
    testLogger.test('Faber waits for a presentation proposal from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise
    const proposal = await faberAgent.proofs.findProposalMessage(faberProofExchangeRecord.id)
    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/propose-presentation',
      id: expect.any(String),
      presentationProposal: {
        type: 'https://didcomm.org/present-proof/1.0/presentation-preview',
        attributes: [
          {
            name: 'name',
            credentialDefinitionId: presentationPreview.attributes[0].credentialDefinitionId,
            value: 'John',
            referent: '0',
          },
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
    expect(faberProofExchangeRecord.id).not.toBeNull()
    expect(faberProofExchangeRecord).toMatchObject({
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.ProposalReceived,
      protocolVersion: 'v1',
    })

    let aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
    })

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.proofs.acceptProposal({
      proofRecordId: faberProofExchangeRecord.id,
    })

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    const request = await faberAgent.proofs.findRequestMessage(faberProofExchangeRecord.id)
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

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })

    faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const presentation = await faberAgent.proofs.findPresentationMessage(faberProofExchangeRecord.id)
    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/presentation',
      id: expect.any(String),
      presentationAttachments: [
        {
          id: 'libindy-presentation-0',
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      // appendedAttachments: [
      //   {
      //     id: expect.any(String),
      //     filename: expect.any(String),
      //     data: {
      //       base64: expect.any(String),
      //     },
      //   },
      // ],
      thread: {
        threadId: expect.any(String),
      },
    })

    expect(faberProofExchangeRecord.id).not.toBeNull()
    expect(faberProofExchangeRecord).toMatchObject({
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: 'v1',
    })

    aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    expect(faberProofExchangeRecord).toMatchObject({
      type: ProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofExchangeRecord).toMatchObject({
      type: ProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })

    const proposalMessage = await aliceAgent.proofs.findProposalMessage(aliceProofExchangeRecord.id)
    const requestMessage = await aliceAgent.proofs.findRequestMessage(aliceProofExchangeRecord.id)
    const presentationMessage = await aliceAgent.proofs.findPresentationMessage(aliceProofExchangeRecord.id)

    expect(proposalMessage).toBeInstanceOf(V1ProposePresentationMessage)
    expect(requestMessage).toBeInstanceOf(V1RequestPresentationMessage)
    expect(presentationMessage).toBeInstanceOf(V1PresentationMessage)

    const formatData = await aliceAgent.proofs.getFormatData(aliceProofExchangeRecord.id)

    // eslint-disable-next-line prefer-const
    let { proposeKey1, proposeKey2, requestKey1, requestKey2 } = getGroupKeysFromIndyProofFormatData(formatData)

    expect(formatData).toMatchObject({
      proposal: {
        indy: {
          name: 'Proof Request',
          version: '1.0',
          nonce: expect.any(String),
          requested_attributes: {
            0: {
              name: 'name',
            },
            [proposeKey1]: {
              name: 'image_0',
              restrictions: [
                {
                  cred_def_id: credDefId,
                },
              ],
            },
          },
          requested_predicates: {
            [proposeKey2]: {
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
        },
      },
      request: {
        indy: {
          name: 'Proof Request',
          version: '1.0',
          nonce: expect.any(String),
          requested_attributes: {
            0: {
              name: 'name',
            },
            [requestKey1]: {
              name: 'image_0',
              restrictions: [
                {
                  cred_def_id: credDefId,
                },
              ],
            },
          },
          requested_predicates: {
            [requestKey2]: {
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
        },
      },
      presentation: {
        indy: {
          proof: expect.any(Object),
          requested_proof: expect.any(Object),
          identifiers: expect.any(Array),
        },
      },
    })
  })

  test('Faber starts with proof request to Alice', async () => {
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

    // Sample predicates
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
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    faberProofExchangeRecord = await faberAgent.proofs.requestProof({
      protocolVersion: 'v1',
      connectionId: faberConnection.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    const request = await faberAgent.proofs.findRequestMessage(faberProofExchangeRecord.id)
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
    })

    expect(aliceProofExchangeRecord.id).not.toBeNull()
    expect(aliceProofExchangeRecord).toMatchObject({
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: 'v1',
    })

    // Alice retrieves the requested credentials and accepts the presentation request
    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits until it receives a presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    const presentation = await faberAgent.proofs.findPresentationMessage(faberProofExchangeRecord.id)
    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/1.0/presentation',
      id: expect.any(String),
      presentationAttachments: [
        {
          id: 'libindy-presentation-0',
          mimeType: 'application/json',
          data: {
            base64: expect.any(String),
          },
        },
      ],
      // appendedAttachments: [
      //   {
      //     id: expect.any(String),
      //     filename: expect.any(String),
      //     data: {
      //       base64: expect.any(String),
      //     },
      //   },
      // ],
      thread: {
        threadId: expect.any(String),
      },
    })

    expect(faberProofExchangeRecord.id).not.toBeNull()
    expect(faberProofExchangeRecord).toMatchObject({
      threadId: faberProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
      protocolVersion: 'v1',
    })

    aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })

    // Faber accepts the presentation
    testLogger.test('Faber accept the presentation from Alice')
    await faberAgent.proofs.acceptPresentation({ proofRecordId: faberProofExchangeRecord.id })

    // Alice waits until she receives a presentation acknowledgement
    testLogger.test('Alice waits for acceptance by Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    expect(faberProofExchangeRecord).toMatchObject({
      type: ProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: aliceProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: ProofState.PresentationReceived,
    })

    expect(aliceProofExchangeRecord).toMatchObject({
      type: ProofExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: faberProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      state: ProofState.Done,
    })
  })

  test('an attribute group name matches with a predicate group name so an error is thrown', async () => {
    // Age attribute
    const attributes = {
      age: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    // Age predicate
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

    await expect(
      faberAgent.proofs.requestProof({
        protocolVersion: 'v1',
        connectionId: faberConnection.id,
        proofFormats: {
          indy: {
            name: 'proof-request',
            version: '1.0',
            requestedAttributes: attributes,
            requestedPredicates: predicates,
          },
        },
      })
    ).rejects.toThrowError(`The proof request contains duplicate predicates and attributes: age`)
  })

  test('Faber starts with proof request to Alice but gets Problem Reported', async () => {
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

    // Sample predicates
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

    const aliceProofExchangeRecordPromise = waitForProofExchangeRecord(aliceAgent, {
      state: ProofState.RequestReceived,
    })

    // Faber sends a presentation request to Alice
    testLogger.test('Faber sends a presentation request to Alice')
    faberProofExchangeRecord = await faberAgent.proofs.requestProof({
      protocolVersion: 'v1',
      connectionId: faberConnection.id,
      proofFormats: {
        indy: {
          name: 'proof-request',
          version: '1.0',
          requestedAttributes: attributes,
          requestedPredicates: predicates,
        },
      },
    })

    // Alice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofExchangeRecord = await aliceProofExchangeRecordPromise

    const request = await faberAgent.proofs.findRequestMessage(faberProofExchangeRecord.id)
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
    })

    expect(aliceProofExchangeRecord.id).not.toBeNull()
    expect(aliceProofExchangeRecord).toMatchObject({
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.RequestReceived,
      protocolVersion: 'v1',
    })

    const faberProofExchangeRecordPromise = waitForProofExchangeRecord(faberAgent, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Abandoned,
    })

    aliceProofExchangeRecord = await aliceAgent.proofs.sendProblemReport({
      proofRecordId: aliceProofExchangeRecord.id,
      description: 'Problem inside proof request',
    })

    faberProofExchangeRecord = await faberProofExchangeRecordPromise

    expect(faberProofExchangeRecord).toMatchObject({
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Abandoned,
      protocolVersion: 'v1',
    })
  })
})
