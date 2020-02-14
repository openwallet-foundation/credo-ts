import logger from '../logger';
import { Dispatcher } from './Dispatcher';
import { Wallet } from '../wallet/Wallet';
import { InitConfig } from '../types';

class MessageReceiver {
  config: InitConfig;
  wallet: Wallet;
  dispatcher: Dispatcher;

  constructor(config: InitConfig, wallet: Wallet, dispatcher: Dispatcher) {
    this.config = config;
    this.wallet = wallet;
    this.dispatcher = dispatcher;
  }

  async receiveMessage(inboundPackedMessage: any) {
    logger.logJson(`Agent ${this.config.label} received message:`, inboundPackedMessage);
    let inboundMessage;

    if (!inboundPackedMessage['@type']) {
      inboundMessage = await this.wallet.unpack(inboundPackedMessage);

      if (!inboundMessage.message['@type']) {
        // TODO In this case we assume we got forwarded JWE message (wire message?) to this agent from agency. We should
        // perhaps try to unpack message in some loop until we have a Aries message in here.
        logger.logJson('Forwarded message', inboundMessage);

        // @ts-ignore
        inboundMessage = await this.wallet.unpack(inboundMessage.message);
      }
    } else {
      inboundMessage = { message: inboundPackedMessage };
    }

    logger.logJson('inboundMessage', inboundMessage);
    return await this.dispatcher.dispatch(inboundMessage);
  }
}

export { MessageReceiver };
