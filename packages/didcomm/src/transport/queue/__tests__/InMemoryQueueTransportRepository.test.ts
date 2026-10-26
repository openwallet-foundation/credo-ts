import { Subject } from 'rxjs'
import { AgentContext } from '../../../../../core/src/agent/context/AgentContext'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { InjectionSymbols } from '../../../../../core/src/constants'
import { agentDependencies, getAgentContext } from '../../../../../core/tests/helpers'
import { DidCommMessagePickupSessionRole } from '../../../modules/message-pickup/DidCommMessagePickupSession'
import { DidCommMessagePickupSessionService } from '../../../modules/message-pickup/services/DidCommMessagePickupSessionService'
import { InMemoryQueueTransportRepository } from '../InMemoryQueueTransportRepository'

describe('InMemoryQueueTransportRepository', () => {
  const payload = { protected: 'base64url', iv: 'base64url', ciphertext: 'base64url', tag: 'base64url' }

  let stop$: Subject<boolean>
  let eventEmitter: EventEmitter
  let agentContext: AgentContext
  let sessionService: DidCommMessagePickupSessionService
  let repository: InMemoryQueueTransportRepository

  function saveLiveSession(connectionId: string, protocolVersion: string): void {
    sessionService.saveLiveSession(agentContext, {
      connectionId,
      protocolVersion,
      role: DidCommMessagePickupSessionRole.MessageHolder,
      transportSessionId: `${connectionId}-transport`,
    })
  }

  beforeEach(() => {
    stop$ = new Subject<boolean>()
    eventEmitter = new EventEmitter(agentDependencies, stop$)
    agentContext = getAgentContext({
      registerInstances: [
        [EventEmitter, eventEmitter],
        [InjectionSymbols.Stop$, stop$],
      ],
    })
    sessionService = new DidCommMessagePickupSessionService()
    repository = new InMemoryQueueTransportRepository()
    repository.start(agentContext)
  })

  test.each(['v2', 'v4'])(
    'puts taken messages back in the queue when the pickup %s live session of their connection ends',
    (protocolVersion) => {
      saveLiveSession('connection-1', protocolVersion)
      saveLiveSession('connection-2', protocolVersion)
      const id = repository.addMessage(agentContext, { connectionId: 'connection-1', recipientDids: [], payload })
      repository.addMessage(agentContext, { connectionId: 'connection-2', recipientDids: [], payload })
      repository.takeFromQueue(agentContext, { connectionId: 'connection-1' })
      repository.takeFromQueue(agentContext, { connectionId: 'connection-2' })

      sessionService.removeLiveSession(agentContext, { connectionId: 'connection-1' })

      expect(repository.takeFromQueue(agentContext, { connectionId: 'connection-1' }).map((msg) => msg.id)).toEqual([
        id,
      ])
      expect(repository.getAvailableMessageCount(agentContext, { connectionId: 'connection-2' })).toBe(0)
    }
  )
})
