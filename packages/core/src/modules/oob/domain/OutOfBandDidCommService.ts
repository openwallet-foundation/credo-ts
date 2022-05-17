import type { ValidationOptions } from 'class-validator'

import { ArrayNotEmpty, buildMessage, IsOptional, isString, IsString, ValidateBy } from 'class-validator'

import { DidDocumentService } from '../../dids'

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

  @ArrayNotEmpty()
  @IsDidKeyString({ each: true })
  public recipientKeys!: string[]

  @IsDidKeyString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  @IsString({ each: true })
  @IsOptional()
  public accept?: string[]
}

/**
 * Checks if a given value is a did:key did string
 */
function IsDidKeyString(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDidKeyString',
      validator: {
        validate: (value): boolean => isString(value) && value.startsWith('did:key:'),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be a did:key string',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
