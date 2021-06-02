import { inject, scoped, Lifecycle } from 'tsyringe'
import { OutboundMessage, UnpackedMessageContext } from '../types'
import { Wallet } from '../wallet/Wallet'
import { ForwardMessage } from '../modules/routing/messages'
import { AgentConfig } from './AgentConfig'
import { Logger } from '../logger'
import { Symbols } from '../symbols'

@scoped(Lifecycle.ContainerScoped)
class EnvelopeService {
  private wallet: Wallet
  private logger: Logger

  public constructor(@inject(Symbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
  }

  public async packMessage(outboundMessage: OutboundMessage): Promise<JsonWebKey> {
    const { routingKeys, recipientKeys, senderVk, payload } = outboundMessage
    const message = payload.toJSON()

    let wireMessage = await this.wallet.pack(message, recipientKeys, senderVk)

    if (routingKeys && routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys

        const forwardMessage = new ForwardMessage({
          to: recipientKey,
          message: wireMessage,
        })

        this.logger.debug('Forward message created', forwardMessage)
        wireMessage = await this.wallet.pack(forwardMessage.toJSON(), [routingKey], senderVk)
      }
    }
    return wireMessage
  }

  public async unpackMessage(packedMessage: JsonWebKey): Promise<UnpackedMessageContext> {
    return this.wallet.unpack(packedMessage)
  }
}

export { EnvelopeService }
