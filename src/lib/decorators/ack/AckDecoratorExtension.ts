import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { BaseMessageConstructor } from '../../agent/BaseMessage';
import { AckDecorator } from './AckDecorator';

export function AckDecorated<T extends BaseMessageConstructor>(Base: T) {
  class AckDecoratorExtension extends Base {
    @Expose({ name: '~please_ack' })
    @Type(() => AckDecorator)
    @ValidateNested()
    public pleaseAck?: AckDecorator;

    public setPleaseAck(pleaseAck: Record<string, unknown>) {
      this.pleaseAck = new AckDecorator({
        pleaseAck,
      });
    }

    public getPleaseAck(): AckDecorator | undefined {
      if (this.pleaseAck) return this.pleaseAck;

      return undefined;
    }
  }

  return AckDecoratorExtension;
}
