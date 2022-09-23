import type { GossipTransportInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { DIDCommV2Message } from '../../../agent/didcomm/v2/DIDCommV2Message'
import { JsonEncoder } from '../../../utils'

@scoped(Lifecycle.ContainerScoped)
export class GossipTransportService implements GossipTransportInterface {
  private config: AgentConfig
  private messageSender: MessageSender

  public constructor(config: AgentConfig, messageSender: MessageSender) {
    this.config = config
    this.messageSender = messageSender
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async send(message: any): Promise<void> {
    this.config.logger.info(`Sending Gossip message with type '${message.type}' to DID ${message?.to}`)
    this.config.logger.debug(` Message: ${JsonEncoder.toString(message)}`)
    const didcomMessage = new DIDCommV2Message({ ...message })
    const sendingMessageType = didcomMessage.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    await this.messageSender.sendDIDCommV2Message(didcomMessage, sendingMessageType)
  }
}
