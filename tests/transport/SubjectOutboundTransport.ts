import type { OutboundTransporter } from '../../src/transport/OutboundTransporter'
import type { OutboundPackage } from '../../src/types'
import type { SubjectMessage } from './SubjectInboundTransport'
import type { Subject } from 'rxjs'

import { AriesFrameworkError } from '../../src'
import testLogger from '../../src/__tests__/logger'

const logger = testLogger

export class SubjectOutboundTransporter implements OutboundTransporter {
  private ourSubject: Subject<SubjectMessage>
  private subjectMap: { [key: string]: Subject<SubjectMessage> | undefined }

  public supportedSchemes = []

  public constructor(
    ourSubject: Subject<SubjectMessage>,
    subjectMap: { [key: string]: Subject<SubjectMessage> | undefined }
  ) {
    this.ourSubject = ourSubject
    this.subjectMap = subjectMap
  }

  public async start(): Promise<void> {
    // Nothing required to start
  }

  public async stop(): Promise<void> {
    // Nothing required to stop
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    logger.debug(`Sending outbound message to connection ${outboundPackage.connection.id}`)
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
