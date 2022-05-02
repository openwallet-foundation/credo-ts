import type { InboundTransport, Agent } from '../../packages/core/src'
import type { TransportSession } from '../../packages/core/src/agent/TransportService'
import type { EncryptedMessage } from '../../packages/core/src/types'
import type { Subject, Subscription } from 'rxjs'

import { AgentConfig } from '../../packages/core/src/agent/AgentConfig'
import { TransportService } from '../../packages/core/src/agent/TransportService'
import { uuid } from '../../packages/core/src/utils/uuid'

export type SubjectMessage = { message: EncryptedMessage; replySubject?: Subject<SubjectMessage> }

export class SubjectInboundTransport implements InboundTransport {
  private ourSubject: Subject<SubjectMessage>
  private subscription?: Subscription

  public constructor(ourSubject: Subject<SubjectMessage>) {
    this.ourSubject = ourSubject
  }

  public async start(agent: Agent) {
    this.subscribe(agent)
  }

  public async stop() {
    this.subscription?.unsubscribe()
  }

  private subscribe(agent: Agent) {
    const logger = agent.injectionContainer.resolve(AgentConfig).logger
    const transportService = agent.injectionContainer.resolve(TransportService)

    this.subscription = this.ourSubject.subscribe({
      next: async ({ message, replySubject }: SubjectMessage) => {
        logger.test('Received message')

        let session: SubjectTransportSession | undefined
        if (replySubject) {
          session = new SubjectTransportSession(`subject-session-${uuid()}`, replySubject)

          // When the subject is completed (e.g. when the session is closed), we need to
          // remove the session from the transport service so it won't be used for sending messages
          // in the future.
          replySubject.subscribe({
            complete: () => session && transportService.removeSession(session),
          })
        }

        await agent.receiveMessage(message, session)
      },
    })
  }
}

export class SubjectTransportSession implements TransportSession {
  public id: string
  public readonly type = 'subject'
  private replySubject: Subject<SubjectMessage>

  public constructor(id: string, replySubject: Subject<SubjectMessage>) {
    this.id = id
    this.replySubject = replySubject
  }

  public async send(encryptedMessage: EncryptedMessage): Promise<void> {
    this.replySubject.next({ message: encryptedMessage })
  }

  public async close(): Promise<void> {
    this.replySubject.complete()
  }
}
