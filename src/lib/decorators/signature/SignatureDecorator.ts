import { Expose } from 'class-transformer';
import { Matches } from 'class-validator';

import { MessageTypeRegExp } from '../../agent/BaseMessage';

/**
 * Represents `[field]~sig` decorator
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0234-signature-decorator/README.md
 */
export class SignatureDecorator {
  constructor(options: SignatureDecorator) {
    if (options) {
      this.signatureType = options.signatureType;
      this.signatureData = options.signatureData;
      this.signer = options.signer;
      this.signature = options.signature;
    }
  }

  @Expose({ name: '@type' })
  @Matches(MessageTypeRegExp)
  signatureType!: string;

  @Expose({ name: 'sig_data' })
  signatureData!: string;

  @Expose({ name: 'signer' })
  signer!: string;

  @Expose({ name: 'signature' })
  signature!: string;
}
