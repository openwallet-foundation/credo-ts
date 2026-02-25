import type { ResolvedDidCommService } from '@credo-ts/core'
import { CredoError, DidDocumentService, DidKey, IsUri, isDid, Kms } from '@credo-ts/core'
import type { ValidationOptions } from 'class-validator'
import { ArrayNotEmpty, buildMessage, IsOptional, IsString, isString, ValidateBy } from 'class-validator'

export class OutOfBandDidCommService extends DidDocumentService {
  public constructor(options: {
    id: string
    serviceEndpoint: string
    recipientKeys: string[]
    routingKeys?: string[]
    accept?: string[]
  }) {
    super({ ...options, type: OutOfBandDidCommService.type })

    if (options) {
      this.recipientKeys = options.recipientKeys
      this.routingKeys = options.routingKeys
      this.accept = options.accept
    }
  }

  public static type = 'did-communication'

  @IsString()
  @IsUri()
  public serviceEndpoint!: string

  @ArrayNotEmpty()
  @IsDidKeyString({ each: true })
  public recipientKeys!: string[]

  @IsDidKeyString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString({ each: true })
  @IsOptional()
  public accept?: string[]

  public get resolvedDidCommService(): ResolvedDidCommService {
    return {
      id: this.id,
      recipientKeys: this.recipientKeys.map((didKey) => {
        const publicJwk = DidKey.fromDid(didKey).publicJwk
        if (!publicJwk.is(Kms.Ed25519PublicJwk)) {
          throw new CredoError('Expected recipient key for didcomm service to be of type Ed25519')
        }

        return publicJwk
      }),
      routingKeys:
        this.routingKeys?.map((didKey) => {
          const publicJwk = DidKey.fromDid(didKey).publicJwk
          if (!publicJwk.is(Kms.Ed25519PublicJwk)) {
            throw new CredoError('Expected recipient key for didcomm service to be of type Ed25519')
          }

          return publicJwk
        }) ?? [],
      serviceEndpoint: this.serviceEndpoint,
    }
  }

  public static fromResolvedDidCommService(service: ResolvedDidCommService) {
    return new OutOfBandDidCommService({
      id: service.id,
      recipientKeys: service.recipientKeys.map((key) => new DidKey(key).did),
      routingKeys: service.routingKeys.map((key) => new DidKey(key).did),
      serviceEndpoint: service.serviceEndpoint,
    })
  }
}

/**
 * Checks if a given value is a did:key did string
 */
function IsDidKeyString(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDidKeyString',
      validator: {
        validate: (value): boolean => isString(value) && isDid(value, 'key'),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a did:key string`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
