import type { Agent, Logger } from '../../packages/core/src'
import type { OutboundTransport } from '../../packages/core/src/transport/OutboundTransport'
import type { OutboundPackage } from '../../packages/core/src/types'
import type { SubjectMessage } from './SubjectInboundTransport'
import type { Subscription } from 'rxjs'

import { Subject } from 'rxjs'

import { InjectionSymbols, AriesFrameworkError } from '../../packages/core/src'

export class SubjectOutboundTransport implements OutboundTransport {
  private logger!: Logger
  private ourSubject = new Subject<SubjectMessage>()
  private subscription?: Subscription
  private subjectMap: { [key: string]: Subject<SubjectMessage> | undefined }

  public supportedSchemes = ['rxjs']

  public constructor(subjectMap: { [key: string]: Subject<SubjectMessage> | undefined }) {
    this.subjectMap = subjectMap
  }

  public async start(agent: Agent): Promise<void> {
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
    this.subscribe(agent)
  }

  public async stop(): Promise<void> {
    this.subscription?.unsubscribe()
  }

  private subscribe(agent: Agent) {
    this.subscription = this.ourSubject.subscribe({
      next: async ({ message }: SubjectMessage) => {
        this.logger.test('Received message')

        await agent.receiveMessage(message)
      },
    })
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    this.logger.debug(`Sending outbound message to endpoint ${outboundPackage.endpoint}`, {
      endpoint: outboundPackage.endpoint,
    })
    const { payload, endpoint } = outboundPackage

    if (!endpoint) {
      throw new AriesFrameworkError('Cannot send message to subject without endpoint')
    }

    const subject = this.subjectMap[endpoint]

    if (!subject) {
      throw new AriesFrameworkError(`No subject found for endpoint ${endpoint}`)
    }

    subject.next({ message: payload, replySubject: this.ourSubject })
  }
}
