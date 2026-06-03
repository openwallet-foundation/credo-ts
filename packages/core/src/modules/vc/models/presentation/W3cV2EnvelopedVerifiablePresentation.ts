import { Expose } from 'class-transformer'
import { buildMessage, IsDataURI, ValidateBy, type ValidationOptions } from 'class-validator'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { CREDENTIALS_CONTEXT_V2_URL, ENVELOPED_VERIFIABLE_PRESENTATION_TYPE } from '../../constants'
import { IsCredentialJsonLdContext } from '../../validators'

export interface W3cV2EnvelopedVerifiablePresentationOptions {
  id: string
  context?: string | Array<string | JsonObject>
  type?: SingleOrArray<string>
}

export class W3cV2EnvelopedVerifiablePresentation {
  public constructor(options: W3cV2EnvelopedVerifiablePresentationOptions) {
    if (options) {
      this.context = options.context ?? CREDENTIALS_CONTEXT_V2_URL
      this.id = options.id
      this.type = options.type ?? ENVELOPED_VERIFIABLE_PRESENTATION_TYPE
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ allowString: true, credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: string | Array<string | JsonObject>

  @IsDataURI()
  public id!: string

  @IsEnvelopedVerifiablePresentationType()
  public type!: SingleOrArray<string>
}

export function IsEnvelopedVerifiablePresentationType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsEnvelopedVerifiablePresentationType',
      validator: {
        validate: (value): boolean => {
          return Array.isArray(value)
            ? value.includes(ENVELOPED_VERIFIABLE_PRESENTATION_TYPE)
            : value === ENVELOPED_VERIFIABLE_PRESENTATION_TYPE
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a string that equals, or an array of strings which includes "${ENVELOPED_VERIFIABLE_PRESENTATION_TYPE}"`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
