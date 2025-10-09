import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { Agent } from '../src'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'

export function setupSubjectTransports(agents: Agent[]) {
  const subjectMap: Record<string, Subject<SubjectMessage>> = {}

  for (const agent of agents) {
    const messages = new Subject<SubjectMessage>()
    subjectMap[agent.didcomm.config.endpoints[0]] = messages
    agent.didcomm.registerInboundTransport(new SubjectInboundTransport(messages))
    agent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  }
}
