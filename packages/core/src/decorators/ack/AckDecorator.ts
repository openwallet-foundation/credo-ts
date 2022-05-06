import { IsArray, IsEnum } from 'class-validator'

export enum AckValues {
  Receipt = 'RECEIPT',
  Outcome = 'OUTCOME',
}

/**
 * Represents `~please_ack` decorator
 */
export class AckDecorator {
  public constructor(options: { on: [AckValues.Receipt] }) {
    if (options) {
      this.on = options.on
    }
  }

  @IsEnum(AckValues, { each: true })
  @IsArray()
  public on!: AckValues[]
}
