import type { WireMessage } from '../src/types'

import { Subject } from 'rxjs'
import WebSocket from 'ws'

import {
  HttpOutboundTransporter,
  Agent,
  MediationState,
  WsOutboundTransporter,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
  PredicateType,
  CredentialState,
  ProofState,
  AutoAcceptCredential,
} from '../src'
import {
  getBaseConfig,
  issueCredential,
  makeConnection,
  prepareForIssuance,
  presentProof,
  previewFromAttributes,
} from '../src/__tests__/helpers'

import { HttpInboundTransporter } from './transport/HttpInboundTransport'
import { SubjectInboundTransporter } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransporter } from './transport/SubjectOutboundTransport'
import { WsInboundTransporter } from './transport/WsInboundTransport'

const recipientConfig = getBaseConfig('E2E Recipient', {
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})
const mediatorConfig = getBaseConfig('E2E Mediator', {
  endpoint: 'http://localhost:3002',
  autoAcceptMediationRequests: true,
})
const senderConfig = getBaseConfig('E2E Sender', {
  endpoint: 'http://localhost:3003',
  mediatorPollingInterval: 1000,
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})

describe('E2E tests', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let senderAgent: Agent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientConfig)
    mediatorAgent = new Agent(mediatorConfig)
    senderAgent = new Agent(senderConfig)
  })

  afterEach(async () => {
    await recipientAgent.shutdown({ deleteWallet: true })
    await mediatorAgent.shutdown({ deleteWallet: true })
    await senderAgent.shutdown({ deleteWallet: true })
  })

  test('Full HTTP flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.setOutboundTransporter(new HttpOutboundTransporter())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.setInboundTransporter(new HttpInboundTransporter())
    mediatorAgent.setOutboundTransporter(new HttpOutboundTransporter())
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.setInboundTransporter(new HttpInboundTransporter())
    senderAgent.setOutboundTransporter(new HttpOutboundTransporter())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })

  test('Full WS flow (connect, request mediation, issue, verify)', async () => {
    // Recipient Setup
    recipientAgent.setOutboundTransporter(new WsOutboundTransporter())
    await recipientAgent.initialize()

    // Mediator Setup
    const mediatorSocketServer = new WebSocket.Server({ port: 3002 })
    mediatorAgent.setInboundTransporter(new WsInboundTransporter(mediatorSocketServer))
    mediatorAgent.setOutboundTransporter(new WsOutboundTransporter())
    await mediatorAgent.initialize()

    // Sender Setup
    const senderSocketServer = new WebSocket.Server({ port: 3003 })
    senderAgent.setInboundTransporter(new WsInboundTransporter(senderSocketServer))
    senderAgent.setOutboundTransporter(new WsOutboundTransporter())
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })

  test('Full Subject flow (connect, request mediation, issue, verify)', async () => {
    const mediatorMessages = new Subject<WireMessage>()
    const recipientMessages = new Subject<WireMessage>()
    const senderMessages = new Subject<WireMessage>()

    const subjectMap = {
      'http://localhost:3002': mediatorMessages,
      'http://localhost:3003': senderMessages,
    }

    // Recipient Setup
    recipientAgent.setOutboundTransporter(new SubjectOutboundTransporter(recipientMessages, subjectMap))
    recipientAgent.setInboundTransporter(new SubjectInboundTransporter(recipientMessages))
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.setOutboundTransporter(new SubjectOutboundTransporter(mediatorMessages, subjectMap))
    mediatorAgent.setInboundTransporter(new SubjectInboundTransporter(mediatorMessages))
    await mediatorAgent.initialize()

    // Sender Setup
    senderAgent.setOutboundTransporter(new SubjectOutboundTransporter(senderMessages, subjectMap))
    senderAgent.setInboundTransporter(new SubjectInboundTransporter(senderMessages))
    await senderAgent.initialize()

    await e2eTest({
      mediatorAgent,
      senderAgent,
      recipientAgent,
    })
  })
})

async function e2eTest({
  mediatorAgent,
  recipientAgent,
  senderAgent,
}: {
  mediatorAgent: Agent
  recipientAgent: Agent
  senderAgent: Agent
}) {
  // Make connection between mediator and recipient
  const [mediatorRecipientConnection, recipientMediatorConnection] = await makeConnection(mediatorAgent, recipientAgent)
  expect(recipientMediatorConnection).toBeConnectedWith(mediatorRecipientConnection)

  // Request mediation from mediator
  const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientMediatorConnection)
  expect(mediationRecord.state).toBe(MediationState.Granted)

  // Set mediator as default for recipient, start picking up messages
  await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
  await recipientAgent.mediationRecipient.initiateMessagePickup(mediationRecord)
  const defaultMediator = await recipientAgent.mediationRecipient.findDefaultMediator()
  expect(defaultMediator?.id).toBe(mediationRecord.id)

  // Make connection between sender and recipient
  const [recipientSenderConnection, senderRecipientConnection] = await makeConnection(recipientAgent, senderAgent)
  expect(recipientSenderConnection).toBeConnectedWith(senderRecipientConnection)

  // Issue credential from sender to recipient
  const { definition } = await prepareForIssuance(senderAgent, ['name', 'age', 'dateOfBirth'])
  const { holderCredential, issuerCredential } = await issueCredential({
    issuerAgent: senderAgent,
    holderAgent: recipientAgent,
    issuerConnectionId: senderRecipientConnection.id,
    credentialTemplate: {
      credentialDefinitionId: definition.id,
      preview: previewFromAttributes({
        name: 'John',
        age: '25',
        // year month day
        dateOfBirth: '19950725',
      }),
    },
  })

  expect(holderCredential.state).toBe(CredentialState.Done)
  expect(issuerCredential.state).toBe(CredentialState.Done)

  const definitionRestriction = [
    new AttributeFilter({
      credentialDefinitionId: definition.id,
    }),
  ]
  const { holderProof, verifierProof } = await presentProof({
    verifierAgent: senderAgent,
    holderAgent: recipientAgent,
    verifierConnectionId: senderRecipientConnection.id,
    presentationTemplate: {
      attributes: {
        name: new ProofAttributeInfo({
          name: 'name',
          restrictions: definitionRestriction,
        }),
      },
      predicates: {
        olderThan21: new ProofPredicateInfo({
          name: 'age',
          restrictions: definitionRestriction,
          predicateType: PredicateType.LessThan,
          predicateValue: 20000712,
        }),
      },
    },
  })

  expect(holderProof.state).toBe(ProofState.Done)
  expect(verifierProof.state).toBe(ProofState.Done)
}
