import logger from '../logger';
import { OutboundMessage, OutboundPackage, UnpackedMessageContext } from '../types';
import { Wallet } from '../wallet/Wallet';
import { ForwardMessage } from '../protocols/routing/ForwardMessage';

class EnvelopeService {
  wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  async packMessage(outboundMessage: OutboundMessage): Promise<OutboundPackage> {
    const { connection, routingKeys, recipientKeys, senderVk, payload, endpoint } = outboundMessage;
    const { verkey, theirKey } = connection;

    const message = payload.toJSON();

    logger.logJson('outboundMessage', { verkey, theirKey, routingKeys, endpoint, message });
    let outboundPackedMessage = await this.wallet.pack(message, recipientKeys, senderVk);

    if (routingKeys && routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys;

        const forwardMessage = new ForwardMessage({
          to: recipientKey,
          message: outboundPackedMessage,
        });

        logger.logJson('Forward message created', forwardMessage);
        outboundPackedMessage = await this.wallet.pack(forwardMessage.toJSON(), [routingKey], senderVk);
      }
    }
    return { connection, payload: outboundPackedMessage, endpoint };
  }

  async unpackMessage(packedMessage: JsonWebKey): Promise<UnpackedMessageContext> {
    return this.wallet.unpack(packedMessage);
  }
}

export { EnvelopeService };
