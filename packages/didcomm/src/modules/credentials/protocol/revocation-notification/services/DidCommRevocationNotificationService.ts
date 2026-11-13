import { InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommRevocationNotificationV1Message } from '../messages/DidCommRevocationNotificationV1Message'
import { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'
import {
  type DidCommRevocationNotificationProcessor,
  DidCommRevocationNotificationProcessorToken,
} from './DidCommRevocationNotificationProcessor'
import type { V2DidCommCreateRevocationNotificationMessageOptions } from './DidCommRevocationNotificationServiceOptions'

@injectable()
export class DidCommRevocationNotificationService {
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  private getProcessor(agentContext: DidCommInboundMessageContext['agentContext']) {
    if (!agentContext.dependencyManager.isRegistered(DidCommRevocationNotificationProcessorToken, true)) {
      this.logger.warn('Ignoring revocation notification: no revocation notification processor is registered')
      return
    }

    return agentContext.dependencyManager.resolve<DidCommRevocationNotificationProcessor>(
      DidCommRevocationNotificationProcessorToken
    )
  }

  /**
   * Dispatch a received {@link DidCommRevocationNotificationV1Message} to the configured processor.
   *
   * @param messageContext message context of RevocationNotificationMessageV1
   */
  public async v1ProcessRevocationNotification(
    messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV1Message>
  ): Promise<void> {
    this.logger.info('Dispatching revocation notification v1', { message: messageContext.message })
    await this.getProcessor(messageContext.agentContext)?.processV1(messageContext)
  }

  /**
   * Create a V2 Revocation Notification message
   */

  public async v2CreateRevocationNotification(
    options: V2DidCommCreateRevocationNotificationMessageOptions
  ): Promise<{ message: DidCommRevocationNotificationV2Message }> {
    const { credentialId, revocationFormat, comment, requestAck } = options
    const message = new DidCommRevocationNotificationV2Message({
      credentialId,
      revocationFormat,
      comment,
    })
    if (requestAck) {
      message.setPleaseAck()
    }

    return { message }
  }

  /**
   * Dispatch a received {@link DidCommRevocationNotificationV2Message} to the configured processor.
   *
   * @param messageContext message context of RevocationNotificationMessageV2
   */
  public async v2ProcessRevocationNotification(
    messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV2Message>
  ): Promise<void> {
    this.logger.info('Dispatching revocation notification v2', { message: messageContext.message })
    await this.getProcessor(messageContext.agentContext)?.processV2(messageContext)
  }
}
