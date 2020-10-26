/**
 * Represents `~please_ack` decorator
 */
export class AckDecorator {
  public constructor(partial?: Partial<AckDecorator>) {
    this.pleaseAck = partial?.pleaseAck;
  }

  public pleaseAck?: Record<string, unknown>;
}
