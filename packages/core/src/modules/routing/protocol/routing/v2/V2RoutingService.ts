import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { Attachment } from '../../../../../decorators/attachment/v2/Attachment'
import type { MediationRecord } from '../../../repository/MediationRecord'
import type { ForwardMessage } from './messages'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { MessageSender } from '../../../../../agent/MessageSender'
import { AriesFrameworkError } from '../../../../../error'
import { injectable } from '../../../../../plugins'
import { MediationRole } from '../../../models/MediationRole'
import { MediationRepository } from '../../../repository/MediationRepository'

import { ForwardHandler } from './handlers'

@injectable()
export class V2RoutingService {
  private mediationRepository: MediationRepository
  private messageSender: MessageSender
  private dispatcher: Dispatcher

  public constructor(mediationRepository: MediationRepository, messageSender: MessageSender, dispatcher: Dispatcher) {
    this.mediationRepository = mediationRepository
    this.messageSender = messageSender
    this.dispatcher = dispatcher

    this.registerHandlers()
  }

  public async processForwardMessage(
    messageContext: InboundMessageContext<ForwardMessage>
  ): Promise<{ mediationRecord: MediationRecord; attachments: Array<Attachment> }> {
    const { message } = messageContext

    const recipient = message.firstRecipient
    if (!recipient) {
      throw new AriesFrameworkError('Invalid Message: Missing required attribute "to"')
    }

    if (!message.attachments) {
      throw new AriesFrameworkError('Invalid Message: Missing attachment')
    }

    const mediationRecord = await this.mediationRepository.getSingleByRecipientKey(
      messageContext.agentContext,
      recipient
    )

    // Assert mediation record is ready to be used
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    return {
      attachments: message.attachments,
      mediationRecord,
    }
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new ForwardHandler(this, this.messageSender))
  }
}
