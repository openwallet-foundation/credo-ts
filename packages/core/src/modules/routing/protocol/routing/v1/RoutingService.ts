import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { EncryptedMessage } from '../../../../../didcomm/types'
import type { MediationRecord } from '../../../repository/MediationRecord'
import type { ForwardMessage } from './messages/ForwardMessage'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { MessageSender } from '../../../../../agent/MessageSender'
import { AriesFrameworkError } from '../../../../../error'
import { injectable } from '../../../../../plugins'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { MediationRole } from '../../../models/MediationRole'
import { MediationRepository } from '../../../repository/MediationRepository'

import { ForwardHandler } from './handlers'

@injectable()
export class RoutingService {
  private mediationRepository: MediationRepository
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private dispatcher: Dispatcher

  public constructor(
    mediationRepository: MediationRepository,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    dispatcher: Dispatcher
  ) {
    this.mediationRepository = mediationRepository
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.dispatcher = dispatcher

    this.registerHandlers()
  }

  public async processForwardMessage(
    messageContext: InboundMessageContext<ForwardMessage>
  ): Promise<{ mediationRecord: MediationRecord; encryptedMessage: EncryptedMessage }> {
    const { message } = messageContext

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new AriesFrameworkError('Invalid Message: Missing required attribute "to"')
    }

    const mediationRecord = await this.mediationRepository.getSingleByRecipientKey(
      messageContext.agentContext,
      message.to
    )

    // Assert mediation record is ready to be used
    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    return {
      encryptedMessage: message.message,
      mediationRecord,
    }
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new ForwardHandler(this, this.connectionService, this.messageSender))
  }
}
