import { OutboundMessage, OutboundPackage, UnpackedMessageContext } from '../types'
import { Wallet } from '../wallet/Wallet'
import { ForwardMessage } from '../modules/routing/messages'
import { AgentConfig } from './AgentConfig'
import { Logger } from '../logger'

class EnvelopeService {
  private wallet: Wallet
  private logger: Logger

  public constructor(wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
  }

  public async packMessage(outboundMessage: OutboundMessage): Promise<OutboundPackage> {
    const { connection, routingKeys, recipientKeys, senderVk, payload, endpoint } = outboundMessage
    const { verkey, theirKey } = connection

    const message = payload.toJSON()

    this.logger.info('outboundMessage', {
      verkey,
      theirKey,
      routingKeys,
      endpoint,
      message,
    })
    let outboundPackedMessage = await this.wallet.pack(message, recipientKeys, senderVk)

    if (routingKeys && routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys

        const forwardMessage = new ForwardMessage({
          to: recipientKey,
          message: outboundPackedMessage,
        })

        this.logger.debug('Forward message created', forwardMessage)
        outboundPackedMessage = await this.wallet.pack(forwardMessage.toJSON(), [routingKey], senderVk)
      }
    }
    return { connection, payload: outboundPackedMessage, endpoint }
  }

  public async unpackMessage(packedMessage: JsonWebKey): Promise<UnpackedMessageContext> {
    return this.wallet.unpack(packedMessage)
  }
}

export { EnvelopeService }
