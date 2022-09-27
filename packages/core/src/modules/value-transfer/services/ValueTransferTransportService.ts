/* eslint-disable @typescript-eslint/no-explicit-any */
import type { VtpTransportInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { DIDCommV2Message } from '../../../agent/didcomm/v2/DIDCommV2Message'
import { JsonEncoder } from '../../../utils'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferTransportService implements VtpTransportInterface {
  private config: AgentConfig
  private messageSender: MessageSender

  public constructor(config: AgentConfig, messageSender: MessageSender) {
    this.config = config
    this.messageSender = messageSender
  }

  public async send(message: any, args?: any): Promise<void> {
    this.config.logger.info(`Sending VTP message with type '${message.type}' to DID ${message?.to}`)
    this.config.logger.debug(` Message: ${JsonEncoder.toString(message)}`)
    const didcomMessage = new DIDCommV2Message({ ...message })
    const sendingMessageType = didcomMessage.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    await this.messageSender.sendDIDCommV2Message(didcomMessage, sendingMessageType, undefined, args?.proxy)
    this.config.logger.info('message sent!')
  }
}
