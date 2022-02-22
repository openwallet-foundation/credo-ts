import type { BaseMessageConstructor } from '../../agent/BaseMessage'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'

import { AckDecorator, AckValues } from './AckDecorator'

export function AckDecorated<T extends BaseMessageConstructor>(Base: T) {
  class AckDecoratorExtension extends Base {
    @Expose({ name: '~please_ack' })
    @Type(() => AckDecorator)
    @ValidateNested()
    @IsInstance(AckDecorator)
    @IsOptional()
    public pleaseAck?: AckDecorator

    public setPleaseAck(on?: [AckValues.Receipt]) {
      if (on) {
        this.pleaseAck = new AckDecorator({ on: on })
      } else {
        this.pleaseAck = new AckDecorator({ on: [AckValues.Receipt] })
      }
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
