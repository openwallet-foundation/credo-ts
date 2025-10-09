import type { Agent } from '../../../../../../../core/src/index'
import type { getJsonLdModules } from '../../../../../../../core/tests'

import { CREDENTIALS_CONTEXT_V1_URL, TypedArrayEncoder } from '../../../../../../../core/src/index'
import { setupJsonLdTests, waitForCredentialRecord, waitForProofExchangeRecord } from '../../../../../../../core/tests'
import testLogger from '../../../../../../../core/tests/logger'
import { DidCommMessageRepository } from '../../../../../repository'
import { DidCommAutoAcceptCredential, DidCommCredentialState } from '../../../../credentials'
import { DidCommProofState } from '../../../models/DidCommProofState'
import { DidCommPresentationV2Message, DidCommRequestPresentationV2Message } from '../messages'
import { DidCommProposePresentationV2Message } from '../messages/DidCommProposePresentationV2Message'

import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src'
import { TEST_INPUT_DESCRIPTORS_CITIZENSHIP } from './fixtures'

const jsonld = {
  credential: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
  },
  options: {
    proofType: 'Ed25519Signature2018',
    proofPurpose: 'assertionMethod',
  },
}

describe('Present Proof', () => {
  let proverAgent: Agent<ReturnType<typeof getJsonLdModules>>
  let issuerAgent: Agent<ReturnType<typeof getJsonLdModules>>
  let verifierAgent: Agent<ReturnType<typeof getJsonLdModules>>

  let issuerProverConnectionId: string
  let proverVerifierConnectionId: string

  beforeAll(async () => {
    testLogger.test('Initializing the agents')
    ;({
      holderAgent: proverAgent,
      issuerAgent,
      verifierAgent,
      issuerHolderConnectionId: issuerProverConnectionId,
      holderVerifierConnectionId: proverVerifierConnectionId,
    } = await setupJsonLdTests({
      holderName: 'presentation exchange prover agent',
      issuerName: 'presentation exchange issuer agent',
      verifierName: 'presentation exchange verifier agent',
      createConnections: true,
      autoAcceptCredentials: DidCommAutoAcceptCredential.Always,
    }))

    const issuerKey = await issuerAgent.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
        type: { kty: 'OKP', crv: 'Ed25519' },
      }).privateJwk,
    })

    await issuerAgent.dids.import({
      did: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      keys: [
        {
          didDocumentRelativeKeyId: '#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          kmsKeyId: issuerKey.keyId,
        },
      ],
    })

    const proverKey = await proverAgent.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
        type: { kty: 'OKP', crv: 'Ed25519' },
      }).privateJwk,
    })

    await proverAgent.dids.import({
      did: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      keys: [
        {
          didDocumentRelativeKeyId: '#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          kmsKeyId: proverKey.keyId,
        },
      ],
    })

    await issuerAgent.didcomm.credentials.offerCredential({
      connectionId: issuerProverConnectionId,
      protocolVersion: 'v2',
      credentialFormats: { jsonld },
    })

    await waitForCredentialRecord(proverAgent, { state: DidCommCredentialState.Done })
  })

  afterAll(async () => {
    testLogger.test('Shutting down both agents')
    await proverAgent.shutdown()
    await verifierAgent.shutdown()
  })

  test('Prover Creates and sends Proof Proposal to a Verifier', async () => {
    testLogger.test('Prover sends proof proposal to a Verifier')

    const verifierPresentationRecordPromise = waitForProofExchangeRecord(verifierAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    await proverAgent.didcomm.proofs.proposeProof({
      connectionId: proverVerifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            input_descriptors: [TEST_INPUT_DESCRIPTORS_CITIZENSHIP],
          },
        },
      },
      comment: 'V2 Presentation Exchange propose proof test',
    })

    testLogger.test('Verifier waits for presentation from the Prover')
    const verifierProofExchangeRecord = await verifierPresentationRecordPromise

    const didCommMessageRepository =
      verifierAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const proposal = await didCommMessageRepository.findAgentMessage(verifierAgent.context, {
      associatedRecordId: verifierProofExchangeRecord.id,
      messageClass: DidCommProposePresentationV2Message,
    })

    expect(proposal).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/propose-presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'dif/presentation-exchange/definitions@v1.0',
        },
      ],
      proposalAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              input_descriptors: expect.any(Array),
            },
          },
        },
      ],
      id: expect.any(String),
      comment: 'V2 Presentation Exchange propose proof test',
    })
    expect(verifierProofExchangeRecord.id).not.toBeNull()
    expect(verifierProofExchangeRecord).toMatchObject({
      threadId: verifierProofExchangeRecord.threadId,
      state: DidCommProofState.ProposalReceived,
      protocolVersion: 'v2',
    })
  })

  test('Verifier accepts the Proposal send by the Prover', async () => {
    testLogger.test('Prover sends proof proposal to a Verifier')

    let proverProofExchangeRecord = await proverAgent.didcomm.proofs.proposeProof({
      connectionId: proverVerifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            input_descriptors: [TEST_INPUT_DESCRIPTORS_CITIZENSHIP],
          },
        },
      },
      comment: 'V2 Presentation Exchange propose proof test',
    })

    const verifierPresentationRecordPromise = waitForProofExchangeRecord(verifierAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    const proverPresentationRecordPromise = waitForProofExchangeRecord(proverAgent, {
      threadId: proverProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Verifier accepts presentation proposal from the Prover')
    let verifierProofExchangeRecord = await verifierPresentationRecordPromise
    verifierProofExchangeRecord = await verifierAgent.didcomm.proofs.acceptProposal({
      proofExchangeRecordId: verifierProofExchangeRecord.id,
    })

    testLogger.test('Prover waits for proof request from the Verifier')
    proverProofExchangeRecord = await proverPresentationRecordPromise

    const didCommMessageRepository =
      proverAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const request = await didCommMessageRepository.findAgentMessage(proverAgent.context, {
      associatedRecordId: proverProofExchangeRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
    })

    expect(request).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/request-presentation',
      id: expect.any(String),
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'dif/presentation-exchange/definitions@v1.0',
        },
      ],
      requestAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              presentation_definition: {
                id: expect.any(String),
                input_descriptors: [
                  {
                    id: TEST_INPUT_DESCRIPTORS_CITIZENSHIP.id,
                    constraints: {
                      fields: TEST_INPUT_DESCRIPTORS_CITIZENSHIP.constraints.fields,
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    })

    expect(proverProofExchangeRecord).toMatchObject({
      id: expect.any(String),
      threadId: verifierProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
      protocolVersion: 'v2',
    })
  })

  test('Prover accepts presentation request from the Verifier', async () => {
    testLogger.test('Prover sends proof proposal to a Verifier')

    let proverProofExchangeRecord = await proverAgent.didcomm.proofs.proposeProof({
      connectionId: proverVerifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            input_descriptors: [TEST_INPUT_DESCRIPTORS_CITIZENSHIP],
          },
        },
      },
      comment: 'V2 Presentation Exchange propose proof test',
    })

    const verifierProposalReceivedPresentationRecordPromise = waitForProofExchangeRecord(verifierAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    const proverPresentationRecordPromise = waitForProofExchangeRecord(proverAgent, {
      threadId: proverProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Verifier accepts presentation proposal from the Prover')
    let verifierProofExchangeRecord = await verifierProposalReceivedPresentationRecordPromise
    verifierProofExchangeRecord = await verifierAgent.didcomm.proofs.acceptProposal({
      proofExchangeRecordId: verifierProofExchangeRecord.id,
    })

    testLogger.test('Prover waits for proof request from the Verifier')
    proverProofExchangeRecord = await proverPresentationRecordPromise

    // Prover retrieves the requested credentials and accepts the presentation request
    testLogger.test('Prover accepts presentation request from Verifier')

    const verifierPresentationRecordPromise = waitForProofExchangeRecord(verifierAgent, {
      threadId: verifierProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    await proverAgent.didcomm.proofs.acceptRequest({
      proofExchangeRecordId: proverProofExchangeRecord.id,
    })

    // Verifier waits for the presentation from the Prover
    testLogger.test('Verifier waits for presentation from the Prover')
    verifierProofExchangeRecord = await verifierPresentationRecordPromise

    const didCommMessageRepository =
      verifierAgent.dependencyManager.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const presentation = await didCommMessageRepository.findAgentMessage(verifierAgent.context, {
      associatedRecordId: verifierProofExchangeRecord.id,
      messageClass: DidCommPresentationV2Message,
    })

    expect(presentation).toMatchObject({
      type: 'https://didcomm.org/present-proof/2.0/presentation',
      formats: [
        {
          attachmentId: expect.any(String),
          format: 'dif/presentation-exchange/submission@v1.0',
        },
      ],
      presentationAttachments: [
        {
          id: expect.any(String),
          mimeType: 'application/json',
          data: {
            json: {
              '@context': expect.any(Array),
              type: expect.any(Array),
              presentation_submission: {
                id: expect.any(String),
                definition_id: expect.any(String),
                descriptor_map: [
                  {
                    id: 'citizenship_input_1',
                    format: 'ldp_vc',
                    path: '$.verifiableCredential[0]',
                  },
                ],
              },
              verifiableCredential: [
                {
                  '@context': [
                    'https://www.w3.org/2018/credentials/v1',
                    'https://www.w3.org/2018/credentials/examples/v1',
                  ],
                  type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                  issuer: expect.any(String),
                  issuanceDate: expect.any(String),
                  credentialSubject: {
                    id: expect.any(String),
                    degree: {
                      type: 'BachelorDegree',
                      name: 'Bachelor of Science and Arts',
                    },
                  },
                  proof: {
                    verificationMethod: expect.any(String),
                    type: 'Ed25519Signature2018',
                    created: expect.any(String),
                    proofPurpose: 'assertionMethod',
                    jws: expect.any(String),
                  },
                },
              ],
              proof: {
                verificationMethod: expect.any(String),
                type: 'Ed25519Signature2018',
                created: expect.any(String),
                proofPurpose: 'authentication',
                challenge: expect.any(String),
                jws: expect.any(String),
              },
            },
          },
        },
      ],
      id: expect.any(String),
      thread: {
        threadId: verifierProofExchangeRecord.threadId,
      },
    })

    expect(verifierProofExchangeRecord.id).not.toBeNull()
    expect(verifierProofExchangeRecord).toMatchObject({
      threadId: verifierProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
      protocolVersion: 'v2',
    })
  })

  test('Verifier accepts the presentation provided by the Prover', async () => {
    testLogger.test('Prover sends proof proposal to a Verifier')

    let proverProofExchangeRecord = await proverAgent.didcomm.proofs.proposeProof({
      connectionId: proverVerifierConnectionId,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            input_descriptors: [TEST_INPUT_DESCRIPTORS_CITIZENSHIP],
          },
        },
      },
      comment: 'V2 Presentation Exchange propose proof test',
    })

    const verifierProposalReceivedPresentationRecordPromise = waitForProofExchangeRecord(verifierAgent, {
      state: DidCommProofState.ProposalReceived,
    })

    const proverPresentationRecordPromise = waitForProofExchangeRecord(proverAgent, {
      threadId: proverProofExchangeRecord.threadId,
      state: DidCommProofState.RequestReceived,
    })

    testLogger.test('Verifier accepts presentation proposal from the Prover')
    let verifierProofExchangeRecord = await verifierProposalReceivedPresentationRecordPromise
    verifierProofExchangeRecord = await verifierAgent.didcomm.proofs.acceptProposal({
      proofExchangeRecordId: verifierProofExchangeRecord.id,
    })

    testLogger.test('Prover waits for proof request from the Verifier')
    proverProofExchangeRecord = await proverPresentationRecordPromise

    // Prover retrieves the requested credentials and accepts the presentation request
    testLogger.test('Prover accepts presentation request from Verifier')

    const verifierPresentationRecordPromise = waitForProofExchangeRecord(verifierAgent, {
      threadId: verifierProofExchangeRecord.threadId,
      state: DidCommProofState.PresentationReceived,
    })

    await proverAgent.didcomm.proofs.acceptRequest({
      proofExchangeRecordId: proverProofExchangeRecord.id,
    })

    // Verifier waits for the presentation from the Prover
    testLogger.test('Verifier waits for presentation from the Prover')
    verifierProofExchangeRecord = await verifierPresentationRecordPromise

    const proverProofExchangeRecordPromise = waitForProofExchangeRecord(proverAgent, {
      threadId: proverProofExchangeRecord.threadId,
      state: DidCommProofState.Done,
    })

    // Verifier accepts the presentation provided by by the Prover
    testLogger.test('Verifier accepts the presentation provided by the Prover')
    await verifierAgent.didcomm.proofs.acceptPresentation({ proofExchangeRecordId: verifierProofExchangeRecord.id })

    // Prover waits until she received a presentation acknowledgement
    testLogger.test('Prover waits until she receives a presentation acknowledgement')
    proverProofExchangeRecord = await proverProofExchangeRecordPromise

    expect(verifierProofExchangeRecord).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: proverProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      isVerified: true,
      state: DidCommProofState.PresentationReceived,
    })

    expect(proverProofExchangeRecord).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: verifierProofExchangeRecord.threadId,
      connectionId: expect.any(String),
      state: DidCommProofState.Done,
    })
  })
})
