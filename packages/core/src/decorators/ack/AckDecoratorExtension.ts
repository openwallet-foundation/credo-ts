import type { DIDComV1BaseMessageConstructor } from '../../agent/didcomm/v1/DIDCommV1BaseMessage'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'

import { AckDecorator } from './AckDecorator'

export function AckDecorated<T extends DIDComV1BaseMessageConstructor>(Base: T) {
  class AckDecoratorExtension extends Base {
    @Expose({ name: '~please_ack' })
    @Type(() => AckDecorator)
    @ValidateNested()
    @IsInstance(AckDecorator)
    @IsOptional()
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
