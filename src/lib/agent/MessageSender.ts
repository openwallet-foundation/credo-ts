import logger from '../logger';
import { Wallet } from '../wallet/Wallet';
import { OutboundMessage, TYPES } from '../types';
import { createForwardMessage } from '../protocols/routing/messages';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { inject, injectable } from 'inversify';

@injectable()
class MessageSender {
  wallet: Wallet;
  outboundTransporter: OutboundTransporter;

  constructor(
    @inject(TYPES.Wallet) wallet: Wallet,
    @inject(TYPES.OutboundTransporter) outboundTransporter: OutboundTransporter
  ) {
    this.wallet = wallet;
    this.outboundTransporter = outboundTransporter;
  }

  async sendMessage(outboundMessage: OutboundMessage) {
    const { connection, routingKeys, recipientKeys, senderVk, payload, endpoint } = outboundMessage;

    const { verkey, theirKey } = connection;
    logger.logJson('outboundMessage', { verkey, theirKey, routingKeys, endpoint, payload });

    const outboundPackedMessage = await this.wallet.pack(payload, recipientKeys, senderVk);

    let message = outboundPackedMessage;
    if (routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys;
        const forwardMessage = createForwardMessage(recipientKey, message);
        logger.logJson('Forward message created', forwardMessage);
        message = await this.wallet.pack(forwardMessage, [routingKey], senderVk);
      }
    }

    const outboundPackage = { connection, payload: message, endpoint };
    this.outboundTransporter.sendMessage(outboundPackage);
  }
}

export { MessageSender };
