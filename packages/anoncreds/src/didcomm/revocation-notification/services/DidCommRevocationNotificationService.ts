import { InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '@credo-ts/didcomm'
import { AnonCredsRevocationNotificationProcessor } from '../../AnonCredsRevocationNotificationProcessor'
import type { DidCommRevocationNotificationV1Message } from '../messages/DidCommRevocationNotificationV1Message'
import { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'
import type { V2DidCommCreateRevocationNotificationMessageOptions } from './DidCommRevocationNotificationServiceOptions'

@injectable()
export class DidCommRevocationNotificationService {
  private logger: Logger
  private processor: AnonCredsRevocationNotificationProcessor

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    processor: AnonCredsRevocationNotificationProcessor
  ) {
    this.logger = logger
    this.processor = processor
  }

  public async v1ProcessRevocationNotification(
    messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV1Message>
  ): Promise<void> {
    this.logger.info('Dispatching revocation notification v1', { message: messageContext.message })
    await this.processor.processV1(messageContext)
  }

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

  public async v2ProcessRevocationNotification(
    messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV2Message>
  ): Promise<void> {
    this.logger.info('Dispatching revocation notification v2', { message: messageContext.message })
    await this.processor.processV2(messageContext)
  }
}
