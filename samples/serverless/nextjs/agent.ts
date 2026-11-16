import { AsyncLocalStorage } from 'node:async_hooks'
import { setTimeout as sleep } from 'node:timers/promises'
import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import type { DidCommBasicMessageStateChangedEvent } from '@credo-ts/didcomm'
import { DidCommBasicMessageEventTypes, DidCommHttpOutboundTransport, DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { after } from 'next/server'

export const endpoint = 'http://localhost:3004'

// Kept on globalThis, as Next.js can evaluate this module more than once
const globalForAgent = globalThis as {
  agent?: ReturnType<typeof createAgent>
  requestStorage?: AsyncLocalStorage<{ id: number; receivedAt: number }>
}
globalForAgent.requestStorage ??= new AsyncLocalStorage()
export const requestStorage = globalForAgent.requestStorage

export function log(message: string) {
  const request = requestStorage.getStore()
  // The time since the request came in
  console.log(request ? `[request ${request.id} +${Date.now() - request.receivedAt}ms] ${message}` : message)
}

function createAgent() {
  const agent = new Agent({
    config: {
      logger: new ConsoleLogger(LogLevel.Warn),
      // Keeps the work Credo starts running after the response has been sent
      waitUntil: (promise) => after(() => promise),
    },
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        askar: NativeAskar,
        store: { id: 'server', key: 'server', database: { type: 'sqlite', config: { inMemory: true } } },
      }),
      didcomm: new DidCommModule({
        endpoints: [endpoint],
        // The route in app/route.ts receives the messages
        transports: { outbound: [new DidCommHttpOutboundTransport()] },
        connections: { autoAcceptConnections: true },
      }),
    },
  })

  // Stands in for slow work after a message is processed, such as calling a webhook
  agent.events.on<DidCommBasicMessageStateChangedEvent>(
    DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
    async ({ payload }) => {
      log(`listener: received "${payload.message.content}", calling the webhook`)
      await sleep(1000)
      log('listener: webhook called')
    }
  )

  return agent.initialize().then(() => agent)
}

export const getAgent = () => {
  globalForAgent.agent ??= createAgent()
  return globalForAgent.agent
}
