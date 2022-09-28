/* eslint-disable @typescript-eslint/no-explicit-any */
import type { VtpTransportInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { DIDCommV2Message } from '../../../agent/didcomm/v2/DIDCommV2Message'
import { JsonEncoder } from '../../../utils'
import { DidResolverService } from '../../dids/services/DidResolverService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferTransportService implements VtpTransportInterface {
  private config: AgentConfig
  private didResolverService: DidResolverService
  private messageSender: MessageSender

  public constructor(config: AgentConfig, messageSender: MessageSender, didResolverService: DidResolverService) {
    this.config = config
    this.messageSender = messageSender
    this.didResolverService = didResolverService
  }

  public async send(message: any, args?: any): Promise<void> {
    this.config.logger.info(`Sending VTP message with type '${message.type}' to DID ${message?.to}`)
    this.config.logger.debug(` Message: ${JsonEncoder.toString(message)}`)
    const didComMessage = new DIDCommV2Message({ ...message })
    const sendingMessageType = didComMessage.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    await this.messageSender.sendDIDCommV2Message(didComMessage, sendingMessageType, undefined, args?.proxy)
    this.config.logger.info('message sent!')
  }
}
