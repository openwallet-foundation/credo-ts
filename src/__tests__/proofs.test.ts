/* eslint-disable no-console */
import indy from 'indy-sdk'
import type { CredDefId } from 'indy-sdk'
import { Subject } from 'rxjs'
import { Agent } from '..'
import {
  ensurePublicDidIsOnLedger,
  makeConnection,
  registerDefinition,
  registerSchema,
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  genesisPath,
  issueCredential,
  waitForProofRecord,
} from './helpers'
import { CredentialPreview, CredentialPreviewAttribute } from '../modules/credentials'
import { InitConfig } from '../types'
import {
  PredicateType,
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
  ProofState,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
} from '../modules/proofs'
import { ConnectionRecord } from '../modules/connections'
import testLogger from './logger'

const faberConfig: InitConfig = {
  label: 'Faber',
  walletConfig: { id: 'proofs-test-faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: process.env.TEST_AGENT_PUBLIC_DID_SEED,
  autoAcceptConnections: true,
  genesisPath,
  poolName: 'proofs-test-faber-pool',
  indy,
  logger: testLogger,
}

const aliceConfig: InitConfig = {
  label: 'Alice',
  walletConfig: { id: 'proofs-test-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  genesisPath,
  poolName: 'proofs-test-alice-pool',
  indy,
  logger: testLogger,
}

const credentialPreview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
  ],
})

describe('Present Proof', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: CredDefId
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview

  beforeAll(async () => {
    const faberMessages = new Subject()
    const aliceMessages = new Subject()

    faberAgent = new Agent(faberConfig)
    faberAgent.setInboundTransporter(new SubjectInboundTransporter(faberMessages, aliceMessages))
    faberAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages))
    await faberAgent.init()

    aliceAgent = new Agent(aliceConfig)
    aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages, faberMessages))
    aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(faberMessages))
    await aliceAgent.init()

    const schemaTemplate = {
      name: `test-schema-${Date.now()}`,
      attributes: ['name', 'age'],
      version: '1.0',
    }
    const [, ledgerSchema] = await registerSchema(faberAgent, schemaTemplate)

    const definitionTemplate = {
      schema: ledgerSchema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { supportRevocation: false },
    }
    const [ledgerCredDefId] = await registerDefinition(faberAgent, definitionTemplate)
    credDefId = ledgerCredDefId

    const publicDid = faberAgent.publicDid?.did
    await ensurePublicDidIsOnLedger(faberAgent, publicDid!)
    const { agentAConnection, agentBConnection } = await makeConnection(faberAgent, aliceAgent)

    faberConnection = agentAConnection
    aliceConnection = agentBConnection

    presentationPreview = new PresentationPreview({
      attributes: [
        new PresentationPreviewAttribute({
          name: 'name',
          credentialDefinitionId: credDefId,
          referent: '0',
          value: 'John',
        }),
      ],
      predicates: [
        new PresentationPreviewPredicate({
          name: 'age',
          credentialDefinitionId: credDefId,
          predicate: PredicateType.GreaterThanOrEqualTo,
          threshold: 50,
        }),
      ],
    })

    await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      credentialTemplate: {
        credentialDefinitionId: credDefId,
        comment: 'some comment about credential',
        preview: credentialPreview,
      },
    })
  })

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet()
    await aliceAgent.closeAndDeleteWallet()
  })

  test('Alice starts with proof proposal to Faber', async () => {
    testLogger.test('Alice sends presentation proposal to Faber')
    let aliceProofRecord = await aliceAgent.proofs.proposeProof(aliceConnection.id, presentationPreview)

    testLogger.test('Faber waits for presentation proposal from Alice')
    let faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.ProposalReceived,
    })

    testLogger.test('Faber accepts presentation proposal from Alice')
    faberProofRecord = await faberAgent.proofs.acceptProposal(faberProofRecord.id)

    testLogger.test('Alice waits for presentation request from Faber')
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest
    const requestedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      indyProofRequest!,
      presentationPreview
    )
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with proof requests to Alice', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const attributes = {
      name: new ProofAttributeInfo({
        name: 'name',
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

    let faberProofRecord = await faberAgent.proofs.requestProof(faberConnection.id, {
      name: 'test-proof-request',
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: faberProofRecord.tags.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest
    const requestedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
      indyProofRequest!,
      presentationPreview
    )
    await aliceAgent.proofs.acceptRequest(aliceProofRecord.id, requestedCredentials)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecord(faberAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.PresentationReceived,
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecord(aliceAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.Done,
    })
  })
})
