import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'

import { Agent } from '@credo-ts/core'
import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'

import { e2eTest, getAskarSqliteAgentOptions } from './helpers'

const aliceInMemoryAgentOptions = getAskarSqliteAgentOptions(
  'AgentsAlice',
  {
    endpoints: ['rxjs:alice'],
  },
  {},
  true
)
const bobInMemoryAgentOptions = getAskarSqliteAgentOptions(
  'AgentsBob',
  {
    endpoints: ['rxjs:bob'],
  },
  {},
  true
)

describe('Askar In Memory agents', () => {
  let aliceAgent: Agent<(typeof aliceInMemoryAgentOptions)['modules']>
  let bobAgent: Agent<(typeof bobInMemoryAgentOptions)['modules']>

  afterAll(async () => {
    if (bobAgent) {
      await bobAgent.shutdown()
    }

    if (aliceAgent) {
      await aliceAgent.shutdown()
    }
  })

  test('In memory Askar wallets E2E test', async () => {
    const aliceMessages = new Subject<SubjectMessage>()
    const bobMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
      'rxjs:bob': bobMessages,
    }

    aliceAgent = new Agent(aliceInMemoryAgentOptions)
    aliceAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    bobAgent = new Agent(bobInMemoryAgentOptions)
    bobAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(bobMessages))
    bobAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await bobAgent.initialize()

    await e2eTest(aliceAgent, bobAgent)
  })
})
