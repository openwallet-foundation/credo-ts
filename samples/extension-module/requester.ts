import type { DummyRecord, DummyStateChangedEvent } from './dummy'

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, CredoError, LogLevel } from '@credo-ts/core'
import {
  ConnectionsModule,
  DidCommModule,
  HttpDidCommOutboundTransport,
  MessagePickupModule,
  OutOfBandModule,
  WsOutboundDidCommTransport,
} from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { ReplaySubject, filter, first, firstValueFrom, map, timeout } from 'rxjs'

import { DummyEventTypes, DummyModule, DummyState } from './dummy'

const run = async () => {
  // Create transports
  const port = process.env.RESPONDER_PORT ? Number(process.env.RESPONDER_PORT) : 3002
  const wsOutboundTransport = new WsOutboundDidCommTransport()
  const httpOutboundTransport = new HttpDidCommOutboundTransport()

  // Setup the agent
  const agent = new Agent({
    config: {
      label: 'Dummy-powered agent - requester',
      logger: new ConsoleLogger(LogLevel.info),
    },
    modules: {
      askar: new AskarModule({
        askar,
        store: {
          id: 'requester',
          key: 'requester',
        },
      }),
      didcomm: new DidCommModule(),
      oob: new OutOfBandModule(),
      messagePickup: new MessagePickupModule(),
      dummy: new DummyModule(),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
    },
    dependencies: agentDependencies,
  })

  // Register transports
  agent.modules.didcomm.registerOutboundTransport(wsOutboundTransport)
  agent.modules.didcomm.registerOutboundTransport(httpOutboundTransport)

  // Now agent will handle messages and events from Dummy protocol

  //Initialize the agent
  await agent.initialize()

  // Connect to responder using its invitation endpoint
  const invitationUrl = await (await agentDependencies.fetch(`http://localhost:${port}/invitation`)).text()
  const { connectionRecord } = await agent.modules.oob.receiveInvitationFromUrl(invitationUrl)
  if (!connectionRecord) {
    throw new CredoError('Connection record for out-of-band invitation was not created.')
  }
  await agent.modules.connections.returnWhenIsConnected(connectionRecord.id)

  // Create observable for Response Received event
  const observable = agent.events.observable<DummyStateChangedEvent>(DummyEventTypes.StateChanged)
  const subject = new ReplaySubject<DummyRecord>(1)

  observable
    .pipe(
      filter((event: DummyStateChangedEvent) => event.payload.dummyRecord.state === DummyState.ResponseReceived),
      map((e) => e.payload.dummyRecord),
      first(),
      timeout(5000)
    )
    .subscribe(subject)

  // Send a dummy request and wait for response
  const record = await agent.modules.dummy.request(connectionRecord.id)
  agent.config.logger.info(`Request sent for Dummy Record: ${record.id}`)

  const dummyRecord = await firstValueFrom(subject)
  agent.config.logger.info(`Response received for Dummy Record: ${dummyRecord.id}`)

  await agent.shutdown()
}

void run()
