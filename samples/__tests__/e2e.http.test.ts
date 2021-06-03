import { Agent, ConnectionRecord, HttpOutboundTransporter, InboundTransporter } from '../../src'

import { get, post } from '../http'
import { getBaseConfig, sleep, waitForBasicMessage, waitForMediationRecord } from '../../src/__tests__/helpers'
import logger from '../../src/__tests__/logger'
import { MediationState } from '../../src/modules/routing/models/MediationState'

describe('with mediator e2e http', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceAtAliceBobId: string

  afterAll(async () => {
    ;(aliceAgent.inboundTransporter as PollingInboundTransporter).stop = true
    ;(bobAgent.inboundTransporter as PollingInboundTransporter).stop = true

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await aliceAgent.closeAndDeleteWallet()
    await bobAgent.closeAndDeleteWallet()
  })

  test('Alice and Bob make a connection with their mediators (by mediator invitation)', async () => {
    const aliceConfig = getBaseConfig('e2e-alice', { clearDefaultMediator: true })
    aliceAgent = new Agent(aliceConfig)
    const aliceInboundTransporter = new PollingInboundTransporter()
    aliceAgent.setInboundTransporter(aliceInboundTransporter)
    aliceAgent.setOutboundTransporter(new HttpOutboundTransporter(aliceAgent))
    await aliceAgent.init()

    const bobConfig = getBaseConfig('e2e-bob', { clearDefaultMediator: true })
    bobAgent = new Agent(bobConfig)
    const bobInboundTransporter = new PollingInboundTransporter()
    bobAgent.setInboundTransporter(bobInboundTransporter)
    bobAgent.setOutboundTransporter(new HttpOutboundTransporter(bobAgent))
    await bobAgent.init()

    // Connect agents with their mediators
    const aliceMediatorResponse = await get('http://localhost:3001/invitation')
    let aliceMediatorConnection = await aliceAgent.connections.receiveInvitation(JSON.parse(aliceMediatorResponse), {
      autoAcceptConnection: true,
      alias: 'mediator',
    })
    aliceMediatorConnection = await aliceAgent.connections.returnWhenIsConnected(aliceMediatorConnection.id)

    // Connect agents with their mediators
    const bobMediatorResponse = await get('http://localhost:3002/invitation')
    let bobMediatorConnection = await bobAgent.connections.receiveInvitation(JSON.parse(bobMediatorResponse), {
      autoAcceptConnection: true,
      alias: 'mediator',
    })

    bobMediatorConnection = await bobAgent.connections.returnWhenIsConnected(bobMediatorConnection.id)

    // Once mediator is connected, mediation request can be sent
    await aliceAgent.mediationRecipient.requestMediation(aliceMediatorConnection)

    // Start polling responses from this connection and wait for mediation granted
    aliceInboundTransporter.stop = true
    aliceInboundTransporter.start(aliceAgent, aliceMediatorConnection)

    const aliceMediationRecord = await waitForMediationRecord(aliceAgent, {
      state: MediationState.Granted,
    })

    await bobAgent.mediationRecipient.requestMediation(bobMediatorConnection)

    bobInboundTransporter.stop = true
    bobInboundTransporter.start(bobAgent, bobMediatorConnection)

    const bobMediationRecord = await waitForMediationRecord(bobAgent, {
      state: MediationState.Granted,
    })

    // Now that mediations were granted, set as inbound connections
    await aliceAgent.mediationRecipient.setDefaultMediator(aliceMediationRecord)
    const aliceInboundConnection = await aliceAgent.mediationRecipient.getDefaultMediatorConnection()
    const aliceKeyAtAliceMediator = aliceInboundConnection?.verkey
    logger.test('aliceInboundConnection', aliceInboundConnection)
    aliceInboundTransporter.stop = true
    aliceInboundTransporter.start(aliceAgent, aliceInboundConnection)

    await bobAgent.mediationRecipient.setDefaultMediator(bobMediationRecord)

    const bobInboundConnection = await bobAgent.mediationRecipient.getDefaultMediatorConnection()
    const bobKeyAtBobMediator = bobInboundConnection?.verkey
    logger.test('bobInboundConnection', bobInboundConnection)
    bobInboundTransporter.stop = true
    bobInboundTransporter.start(bobAgent, bobInboundConnection)

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`http://localhost:3001/api/connections/${aliceKeyAtAliceMediator}`)
    )
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`http://localhost:3002/api/connections/${bobKeyAtBobMediator}`)
    )

    expect(aliceInboundConnection).toBeConnectedWith(mediatorConnectionAtAliceMediator)
    expect(bobInboundConnection).toBeConnectedWith(mediatorConnectionAtBobMediator)
  })

  test('Alice and Bob make a connection via mediator', async () => {
    // eslint-disable-next-line prefer-const
    let { invitation, connectionRecord: aliceAgentConnection } = await aliceAgent.connections.createConnection()

    const defaultMediator = await bobAgent.mediationRecipient.getDefaultMediator()
    let mediatorId
    if (defaultMediator) {
      mediatorId = defaultMediator.id
    }
    let bobAgentConnection = await bobAgent.connections.receiveInvitation(invitation, { mediatorId })

    aliceAgentConnection = await aliceAgent.connections.returnWhenIsConnected(aliceAgentConnection.id)

    bobAgentConnection = await bobAgent.connections.returnWhenIsConnected(bobAgentConnection!.id)

    expect(aliceAgentConnection).toBeConnectedWith(bobAgentConnection)
    expect(bobAgentConnection).toBeConnectedWith(aliceAgentConnection)

    // We save this verkey to send message via this connection in the following test
    aliceAtAliceBobId = aliceAgentConnection.id
  })

  test('Send a message from Alice to Bob via mediator', async () => {
    // send message from Alice to Bob
    const aliceConnectionAtAliceBob = await aliceAgent.connections.findById(aliceAtAliceBobId)
    if (!aliceConnectionAtAliceBob) {
      throw new Error(`There is no connection for id ${aliceAtAliceBobId}`)
    }

    logger.test('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob)

    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnectionAtAliceBob, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })
})

class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean

  public constructor() {
    this.stop = false
  }

  public async start(agent: Agent, mediatorConnection?: ConnectionRecord) {
    this.stop = false

    if (mediatorConnection) {
      this.pollDownloadMessages(agent, mediatorConnection)
    }
  }

  private pollDownloadMessages(agent: Agent, mediatorConnection: ConnectionRecord) {
    const loop = async () => {
      while (!this.stop) {
        await agent.mediationRecipient.downloadMessages(mediatorConnection)
        await sleep(1000)
      }
    }
    new Promise(() => {
      loop()
    })
  }
}
