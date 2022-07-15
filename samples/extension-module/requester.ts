import type { DummyRecord, DummyStateChangedEvent } from './dummy'

import { Agent, AriesFrameworkError, ConsoleLogger, LogLevel, WsOutboundTransport } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { filter, first, firstValueFrom, map, ReplaySubject, timeout } from 'rxjs'

import { DummyEventTypes, DummyApi, DummyState, DummyModule } from './dummy'

const run = async () => {
  // Create transports
  const port = process.env.RESPONDER_PORT ? Number(process.env.RESPONDER_PORT) : 3002
  const wsOutboundTransport = new WsOutboundTransport()

  // Setup the agent
  const agent = new Agent(
    {
      label: 'Dummy-powered agent - requester',
      walletConfig: {
        id: 'requester',
        key: 'requester',
      },
      logger: new ConsoleLogger(LogLevel.test),
      autoAcceptConnections: true,
    },
    agentDependencies
  )

  // Register the DummyModule
  agent.dependencyManager.registerModules(new DummyModule())

  // Register transports
  agent.registerOutboundTransport(wsOutboundTransport)

  // Inject DummyApi
  const dummyApi = agent.dependencyManager.resolve(DummyApi)

  // Now agent will handle messages and events from Dummy protocol

  //Initialize the agent
  await agent.initialize()

  // Connect to responder using its invitation endpoint
  const invitationUrl = await (await agentDependencies.fetch(`http://localhost:${port}/invitation`)).text()
  const { connectionRecord } = await agent.oob.receiveInvitationFromUrl(invitationUrl)
  if (!connectionRecord) {
    throw new AriesFrameworkError('Connection record for out-of-band invitation was not created.')
  }
  await agent.connections.returnWhenIsConnected(connectionRecord.id)

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
  const record = await dummyApi.request(connectionRecord.id)
  agent.config.logger.info(`Request received for Dummy Record: ${record.id}`)

  const dummyRecord = await firstValueFrom(subject)
  agent.config.logger.info(`Response received for Dummy Record: ${dummyRecord.id}`)

  await agent.shutdown()
}

void run()
