import type { ResolvedDidCommService } from '@credo-ts/core'

import { TypedArrayEncoder, utils, verkeyToPublicJwk } from '@credo-ts/core'
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

  public get resolvedDidCommService(): ResolvedDidCommService {
    return {
      id: utils.uuid(),
      recipientKeys: this.recipientKeys.map(verkeyToPublicJwk),
      routingKeys: this.routingKeys?.map(verkeyToPublicJwk) ?? [],
      serviceEndpoint: this.serviceEndpoint,
    }
  }

  public static fromResolvedDidCommService(service: ResolvedDidCommService): ServiceDecorator {
    return new ServiceDecorator({
      recipientKeys: service.recipientKeys.map((k) => TypedArrayEncoder.toBase58(k.publicKey.publicKey)),
      routingKeys: service.routingKeys.map((k) => TypedArrayEncoder.toBase58(k.publicKey.publicKey)),
      serviceEndpoint: service.serviceEndpoint,
    })
  }
}
