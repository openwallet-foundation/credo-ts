import logger from '../logger';
import { OutboundMessage } from '../types';
import { Wallet } from '../wallet/Wallet';
import { createForwardMessage } from '../protocols/routing/messages';

class EnvelopeService {
  wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  async packMessage(outboundMessage: OutboundMessage) {
    const { connection, routingKeys, recipientKeys, senderVk, payload, endpoint } = outboundMessage;
    const { verkey, theirKey } = connection;

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

  async unpackMessage(packedMessage: JsonWebKey) {
    return this.wallet.unpack(packedMessage);
  }
}

export { EnvelopeService };
