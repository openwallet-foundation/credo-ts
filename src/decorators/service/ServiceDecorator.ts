import { IsArray, IsOptional, IsString } from 'class-validator'

export interface ServiceDecoratorOptions {
  recipientKeys: string[]
  routingKeys?: string[]
  serviceEndpoint: string
}

/**
 * Represents `~service` decorator
 *
 * Based on specification Aries RFC 0056: Service Decorator
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0056-service-decorator
 */
export class ServiceDecorator {
  public constructor(options: ServiceDecoratorOptions) {
    if (options) {
      this.recipientKeys = options.recipientKeys
      this.routingKeys = options.routingKeys
      this.serviceEndpoint = options.serviceEndpoint
    }
  }

  @IsArray()
  @IsString({ each: true })
  public recipientKeys!: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString()
  public serviceEndpoint!: string
}
