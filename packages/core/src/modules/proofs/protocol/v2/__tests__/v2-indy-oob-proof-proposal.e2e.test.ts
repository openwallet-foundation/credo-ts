import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { V1CredentialPreview } from '../../../../../../../anoncreds/src'
import {
  setupAnonCredsTests,
  getLegacyAnonCredsModules,
  issueLegacyAnonCredsCredential,
  prepareForAnonCredsIssuance,
} from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import {
  testLogger,
  waitForProofExchangeRecordSubject,
  getAgentOptions,
  setupEventReplaySubjects,
  makeConnection,
} from '../../../../../../tests'
import { Agent } from '../../../../../agent/Agent'
import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import { uuid } from '../../../../../utils/uuid'
import { HandshakeProtocol } from '../../../../connections'
import { CredentialEventTypes } from '../../../../credentials'
import { DidKey } from '../../../../dids'
import { MediatorPickupStrategy } from '../../../../routing'
import { ProofEventTypes } from '../../../ProofEvents'
import { AutoAcceptProof, ProofState } from '../../../models'
import { V2PresentationMessage, V2ProposePresentationMessage, V2RequestPresentationMessage } from '../messages'

describe('V2 OOB Proposal Proposal - Indy', () => {
  let agents: Agent[]

  afterEach(async () => {
    for (const agent of agents) {
      await agent.shutdown()
      await agent.wallet.delete()
    }
  })

  test('Alice start with oob proof proposal for Faber', async () => {
    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber oob Proofs proposal v2',
      holderName: 'Alice oob Proofs proposal v2',
      autoAcceptProofs: AutoAcceptProof.Never,
      attributeNames: ['name', 'age'],
    })

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      issuerHolderConnectionId: faberConnectionId,
      offer: {
        credentialDefinitionId,
        attributes: [
          {
            name: 'name',
            value: 'Alice',
          },
          {
            name: 'age',
            value: '99',
          },
        ],
      },
    })

    agents = [aliceAgent, faberAgent]
    testLogger.test('Alice creates oob proof proposal for faber')

    const { message } = await aliceAgent.proofs.createProofProposal({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          attributes: [
            {
              name: 'name',
              value: 'Alice',
              credentialDefinitionId,
            },
          ],
          predicates: [
            {
              name: 'age',
              predicate: '>=',
              threshold: 50,
              credentialDefinitionId,
            },
          ],
        },
      },
    })
    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation({
      messages: [message],
      autoAcceptConnection: true,
    })

    await faberAgent.oob.receiveInvitation(outOfBandInvitation)
    testLogger.test('Faber waits for proof proposal message from Alice')
    let faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.ProposalReceived,
    })

    // Faber accepts the presentation proposal from Alice
    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofExchangeRecord = await faberAgent.proofs.acceptProposal({
      proofRecordId: faberProofExchangeRecord.id,
    })

    // ALice waits for presentation request from Faber
    testLogger.test('Alice waits for presentation request from faber')
    let aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.RequestReceived,
    })
    expect(aliceProofExchangeRecord.connectionId).not.toBeNull()

    // Alice retrieves the requested credentials and accepts the presentation
    testLogger.test('Alice accepts presentation request from faber')
    const requestedCredentials = await aliceAgent.proofs.selectCredentialsForRequest({
      proofRecordId: aliceProofExchangeRecord.id,
    })
    await aliceAgent.proofs.acceptRequest({
      proofRecordId: aliceProofExchangeRecord.id,
      proofFormats: { indy: requestedCredentials.proofFormats.indy },
    })

    // Faber waits for the presentation from Alice
    testLogger.test('Faber waits for presentation from Alice')
    faberProofExchangeRecord = await waitForProofExchangeRecordSubject(faberReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.PresentationReceived,
    })

    // Faber accepts the presentation provided by Alice
    testLogger.test('Faber accepts the presentation provided by Alice')
    await faberAgent.proofs.acceptPresentation({
      proofRecordId: faberProofExchangeRecord.id,
    })

    // Alice waits utils she received a presentation acknowledgement
    testLogger.test('Alice waits until she receives a presentation acknowledgement')
    aliceProofExchangeRecord = await waitForProofExchangeRecordSubject(aliceReplay, {
      threadId: aliceProofExchangeRecord.threadId,
      state: ProofState.Done,
    })

    const proposalMessage = await aliceAgent.proofs.findProposalMessage(aliceProofExchangeRecord.id)
    const requestMessage = await aliceAgent.proofs.findRequestMessage(aliceProofExchangeRecord.id)
    const presentationMessage = await aliceAgent.proofs.findPresentationMessage(aliceProofExchangeRecord.id)

    expect(proposalMessage).toBeInstanceOf(V2ProposePresentationMessage)
    expect(requestMessage).toBeInstanceOf(V2RequestPresentationMessage)
    expect(presentationMessage).toBeInstanceOf(V2PresentationMessage)
  })

  test('Alice start with oob proof proposal for Faber with aut-accept enabled', async () => {
    const {
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
    } = await setupAnonCredsTests({
      issuerName: 'Faber oob Proofs proposal v2 - Auto Accept',
      holderName: 'Alice oob Proofs proposal v2 - Auto Accept',
      autoAcceptProofs: AutoAcceptProof.Always,
      attributeNames: ['name', 'age'],
    })

    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      issuerHolderConnectionId: faberConnectionId,
      offer: {
        credentialDefinitionId,
        attributes: [
          {
            name: 'name',
            value: 'Alice',
          },
          {
            name: 'age',
            value: '99',
          },
        ],
      },
    })

    agents = [aliceAgent, faberAgent]
    testLogger.test('Alice creates oob proof proposal for faber')

    const { message } = await aliceAgent.proofs.createProofProposal({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          attributes: [
            {
              name: 'name',
              value: 'Alice',
              credentialDefinitionId,
            },
          ],
          predicates: [
            {
              name: 'age',
              predicate: '>=',
              threshold: 50,
              credentialDefinitionId,
            },
          ],
        },
      },
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    })
    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation({
      messages: [message],
      autoAcceptConnection: true,
    })

    await faberAgent.oob.receiveInvitation(outOfBandInvitation)

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
    })
    await waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
    })
  })

  test('Alice start with oob proof proposal for Faber with auto-accept enabled and both agents having a mediator', async () => {
    const credentialPreview = V1CredentialPreview.fromRecord({
      name: 'Alice',
      age: '99',
    })

    const unique = uuid().substring(0, 4)
    const mediatorOptions = getAgentOptions(
      `OOB proof proposal with mediator Mediator-${unique}`,
      {
        autoAcceptMediationRequests: true,
        endpoints: ['rxjs:mediator'],
      },
      getLegacyAnonCredsModules({
        autoAcceptProofs: AutoAcceptProof.Always,
      })
    )
    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = { 'rxjs:mediator': mediatorMessages }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorOptions)
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    const faberMediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'faber invitation',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const aliceMediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'alice invitation',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const faberOptions = getAgentOptions(
      `OOB proof proposal with mediator Faber-${unique}`,
      {
        mediatorConnectionsInvite: faberMediationOutOfBandRecord.outOfBandInvitation.toUrl({
          domain: 'https://example.com',
        }),
        mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
      },
      getLegacyAnonCredsModules({
        autoAcceptProofs: AutoAcceptProof.Always,
      })
    )

    const aliceOptions = getAgentOptions(
      `OOB proof proposal with mediator Alice-${unique}`,
      {
        mediatorConnectionsInvite: aliceMediationOutOfBandRecord.outOfBandInvitation.toUrl({
          domain: 'https://example.com',
        }),
        mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
      },
      getLegacyAnonCredsModules({
        autoAcceptProofs: AutoAcceptProof.Always,
      })
    )

    const faberAgent = new Agent(faberOptions)
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceOptions)
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    const [faberReplay, aliceReplay] = setupEventReplaySubjects(
      [faberAgent, aliceAgent],
      [CredentialEventTypes.CredentialStateChanged, ProofEventTypes.ProofStateChanged]
    )
    agents = [aliceAgent, faberAgent, mediatorAgent]

    await aliceAgent.modules.anoncreds.createLinkSecret({
      linkSecretId: 'default',
      setAsDefault: true,
    })

    const { credentialDefinition } = await prepareForAnonCredsIssuance(faberAgent, {
      attributeNames: ['name', 'age', 'image_0', 'image_1'],
    })

    const [faberConnection] = await makeConnection(faberAgent, aliceAgent)

    // issue credential with two linked attachments
    await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      offer: {
        credentialDefinitionId: credentialDefinition.credentialDefinitionId,
        attributes: credentialPreview.attributes,
        linkedAttachments: [
          new LinkedAttachment({
            name: 'image_0',
            attachment: new Attachment({
              filename: 'picture-of-a-cat.png',
              data: new AttachmentData({ base64: 'cGljdHVyZSBvZiBhIGNhdA==' }),
            }),
          }),
          new LinkedAttachment({
            name: 'image_1',
            attachment: new Attachment({
              filename: 'picture-of-a-dog.png',
              data: new AttachmentData({ base64: 'UGljdHVyZSBvZiBhIGRvZw==' }),
            }),
          }),
        ],
      },
    })

    testLogger.test('Alice creates oob proof proposal for faber')
    const { message } = await aliceAgent.proofs.createProofProposal({
      protocolVersion: 'v2',
      proofFormats: {
        indy: {
          name: 'abc',
          version: '1.0',
          attributes: [
            {
              name: 'name',
              credentialDefinitionId: credentialDefinition.credentialDefinitionId,
            },
          ],
          predicates: [
            {
              name: 'age',
              predicate: '>=',
              threshold: 50,
              credentialDefinitionId: credentialDefinition.credentialDefinitionId,
            },
          ],
        },
      },
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    })

    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation({
      messages: [message],
      autoAcceptConnection: true,
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const mediationRecord = await aliceAgent.mediationRecipient.findDefaultMediator()
    if (!mediationRecord) throw new Error('Alice agent has no default mediator')

    expect(outOfBandInvitation.getInlineServices()[0]).toMatchObject({
      recipientKeys: [expect.any(String)],
      routingKeys: mediationRecord.routingKeys.map((key) => {
        return new DidKey(Key.fromPublicKeyBase58(key, KeyType.Ed25519)).did
      }),
      serviceEndpoint: mediationRecord.endpoint,
    })

    await faberAgent.oob.receiveInvitation(outOfBandInvitation, { autoAcceptConnection: true })

    await waitForProofExchangeRecordSubject(aliceReplay, {
      state: ProofState.Done,
    })
    await waitForProofExchangeRecordSubject(faberReplay, {
      state: ProofState.Done,
    })
  })
})
