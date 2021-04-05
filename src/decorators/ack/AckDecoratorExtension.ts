import { Expose, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { BaseMessageConstructor } from '../../agent/BaseMessage'
import { AckDecorator } from './AckDecorator'

export function AckDecorated<T extends BaseMessageConstructor>(Base: T) {
  class AckDecoratorExtension extends Base {
    @Expose({ name: '~please_ack' })
    @Type(() => AckDecorator)
    @ValidateNested()
    public pleaseAck?: AckDecorator

    public setPleaseAck() {
      this.pleaseAck = new AckDecorator()
    }

    public getPleaseAck(): AckDecorator | undefined {
      return this.pleaseAck
    }

    public requiresAck(): boolean {
      return this.pleaseAck !== undefined
    }
  }

  return AckDecoratorExtension
}
