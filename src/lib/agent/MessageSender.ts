import logger from '../logger';
import { Wallet } from '../wallet/Wallet';
import { OutboundMessage } from '../types';
import { createForwardMessage } from '../protocols/routing/messages';
import { OutboundTransporter } from '../transport/OutboundTransporter';

class MessageSender {
  wallet: Wallet;
  outboundTransporter: OutboundTransporter;

  constructor(wallet: Wallet, outboundTransporter: OutboundTransporter) {
    this.wallet = wallet;
    this.outboundTransporter = outboundTransporter;
  }

  async packMessage(outboundMessage: OutboundMessage, receive_reply: boolean = false) {
    const { connection, routingKeys, recipientKeys, senderVk, payload, endpoint } = outboundMessage;
    const { verkey, theirKey } = connection;

    if (receive_reply) {
      if (!payload['~transport']) {
        payload['~transport'] = {
          return_route: 'all',
        };
      }
    }

    logger.logJson('outboundMessage', { verkey, theirKey, routingKeys, endpoint, payload });
    const outboundPackedMessage = await this.wallet.pack(payload, recipientKeys, senderVk);

    let message = outboundPackedMessage;
    if (routingKeys && routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys;
        const forwardMessage = createForwardMessage(recipientKey, message);
        logger.logJson('Forward message created', forwardMessage);
        message = await this.wallet.pack(forwardMessage, [routingKey], senderVk);
      }
    }
    return { connection, payload: message, endpoint };
  }

  async sendMessage(outboundMessage: OutboundMessage, receive_reply: boolean = false) {
    const outboundPackage = await this.packMessage(outboundMessage, receive_reply);
    const reply = await this.outboundTransporter.sendMessage(outboundPackage, receive_reply);
    if (receive_reply) {
      return reply;
    }
  }

  async sendMessageAndGetReply(outboundMessage: OutboundMessage) {
    return await this.sendMessage(outboundMessage, true);
  }
}

export { MessageSender };
