import WebSocket from 'ws'

import { HttpOutboundTransporter, Agent, MediationState, WsOutboundTransporter } from '../../src'
import { closeAndDeleteWallet, getBaseConfig, makeConnection, makeTransport } from '../../src/__tests__/helpers'
import { HttpInboundTransporter } from '../transport/HttpInboundTransport'
import { WsInboundTransporter } from '../transport/WsInboundTransport'

const recipientConfig = getBaseConfig('recipient')
const mediatorConfig = getBaseConfig('mediator', {
  host: 'http://localhost',
  port: 3002,
  autoAcceptMediationRequests: true,
})

describe('mediator establishment', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientConfig)
    mediatorAgent = new Agent(mediatorConfig)
  })

  afterEach(async () => {
    // Close and delete wallets
    await closeAndDeleteWallet(recipientAgent)
    await closeAndDeleteWallet(mediatorAgent)

    // Stop all transports
    await recipientAgent.outboundTransporter?.stop()
    await recipientAgent.inboundTransporter?.stop()
    await mediatorAgent.outboundTransporter?.stop()
    await mediatorAgent.inboundTransporter?.stop()
  })

  test('recipient and mediator establish a connection and granted mediation with HTTP', async () => {
    await makeTransport({ agent: recipientAgent, outboundTransporter: new HttpOutboundTransporter() })
    await makeTransport({
      agent: mediatorAgent,
      inboundTransporter: new HttpInboundTransporter(),
      outboundTransporter: new HttpOutboundTransporter(),
    })

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)
    const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientAgentConnection)
    expect(mediationRecord.state).toBe(MediationState.Granted)
  })

  test('recipient and mediator establish a connection and granted mediation with WebSockets', async () => {
    await makeTransport({
      agent: recipientAgent,
      outboundTransporter: new WsOutboundTransporter(),
    })

    const mediatorSocketServer = new WebSocket.Server({ noServer: false, port: 3002 })
    await makeTransport({
      agent: mediatorAgent,
      inboundTransporter: new WsInboundTransporter(mediatorSocketServer),
      outboundTransporter: new WsOutboundTransporter(),
    })

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)

    const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientAgentConnection)
    expect(mediationRecord.state).toBe(MediationState.Granted)
  })
})

/*
 * tests below are dependent on pickup protocol which is not available yet.
 * they could be constructed to use trust ping to retrieve messages, but that is not advisable by some developers
 * and is intentionally not demonstrated below.
 */

/*describe('mediator features', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let mediationRecord: MediationRecord
  let tedAgent: Agent
  beforeAll(done => {done()})
  beforeEach(async () => {
    try {
      recipientAgent = new Agent(recipientConfig)
      mediatorAgent = new Agent(mediatorConfig, new InMemoryMessageRepository())
      tedAgent = new Agent(tedConfig, new InMemoryMessageRepository())
      await makeTransport(
        recipientAgent,
        new TrustPingPollingInboundTransporter(),
        new HttpOutboundTransporter(recipientAgent)
      )
      await makeTransport(mediatorAgent, makeInBoundTransporter(), new HttpOutboundTransporter(mediatorAgent))
      await makeTransport(tedAgent, makeInBoundTransporter(), new HttpOutboundTransporter(tedAgent))
      const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
        await makeConnection(mediatorAgent, recipientAgent, {
          autoAcceptConnection: true,
        })
      mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientAgentConnection)
    } catch (e) {
      throw e
    }
  })
  afterEach(async () => {
    try {
      await (recipientAgent.inboundTransporter as TrustPingPollingInboundTransporter).stop()
    } catch (e) {}
    try {
      await (mediatorAgent.inboundTransporter as MockInBoundTransporter).stop()
    } catch (e) {}
    try {
      await (tedAgent.inboundTransporter as MockInBoundTransporter).stop()
    } catch (e) {}
    try {
      await recipientAgent.closeAndDeleteWallet()
    } catch (e) {}
    try {
      await mediatorAgent.closeAndDeleteWallet()
    } catch (e) {}
    try {
      await tedAgent.closeAndDeleteWallet()
    } catch (e) {}
    afterAll(async done =>{
      try { await recipientAgent.closeAndDeleteWallet()} catch (e){}
      try { await mediatorAgent.closeAndDeleteWallet()} catch (e){}
      try { await tedAgent.closeAndDeleteWallet()} catch (e){}
      done()
    })
  })

  test('should set default mediator and retrieve', async () => {
    expect.assertions(1)
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const retrievedMediationRecord = await recipientAgent.mediationRecipient.getDefaultMediator()
    expect(mediationRecord).toBe(retrievedMediationRecord)
  })

  test('should get default mediator connection, and get default mediator from connection id', async () => {
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const recipientMediatorConnection = await recipientAgent.mediationRecipient.getDefaultMediatorConnection()
    if (recipientMediatorConnection) {
      expect(recipientMediatorConnection?.isReady)
      const recipientMediatorRecord = await recipientAgent.mediationRecipient.findByConnectionId(
        recipientMediatorConnection.id
      )
    } else {
      throw new Error('no mediator connection found.')
    }
  })
  test('recipient and Ted make a connection via mediator', async () => {
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    let { invitation, connectionRecord: agentAConnection } = await recipientAgent.connections.createConnection({
      autoAcceptConnection: true,
      mediatorId: mediationRecord.id,
    })
    let agentBConnection = await tedAgent.connections.receiveInvitation(invitation, { autoAcceptConnection: true })
    agentAConnection = await recipientAgent.connections.returnWhenIsConnected(agentAConnection.id)
    agentBConnection = await tedAgent.connections.returnWhenIsConnected(agentBConnection.id)
    expect(agentAConnection).toBeConnectedWith(agentBConnection)
    expect(agentBConnection).toBeConnectedWith(agentAConnection)
    expect(agentBConnection.isReady)
  })

  /*test('Send a message from recipient to ted via mediator', async () => {
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const { agentAConnection: recipientAgentConnection, agentBConnection: tedRecipientConnection } =
    await makeConnection(recipientAgent, tedAgent, {
      autoAcceptConnection: true,
    })
     // send message from recipient to ted
    const message = 'hello, world'
     await recipientAgent.basicMessages.sendMessage(tedRecipientConnection, message)
     const basicMessage = await waitForBasicMessage(recipientAgent, {
       content: message,
    })

     expect(basicMessage.content).toBe(message)
   })
})*/
