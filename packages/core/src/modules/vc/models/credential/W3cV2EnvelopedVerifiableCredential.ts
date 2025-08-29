import { Expose } from 'class-transformer'
import { IsDataURI, IsOptional, ValidateBy, ValidationOptions, buildMessage } from 'class-validator'
import { CredoError } from '../../../../error'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { CREDENTIALS_CONTEXT_V2_URL, ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE } from '../../constants'
import { W3cV2SdJwtVerifiableCredential } from '../../sd-jwt-vc'
import { IsCredentialJsonLdContext } from '../../validators'

export interface W3cV2EnvelopedVerifiableCredentialOptions {
  id: string
  context?: string | Array<string | JsonObject>
  type?: SingleOrArray<string>
  [property: string]: unknown
}

export class W3cV2EnvelopedVerifiableCredential {
  private _credential?: W3cV2SdJwtVerifiableCredential

  public constructor(options: W3cV2EnvelopedVerifiableCredentialOptions) {
    if (options) {
      const { id, context, type, ...properties } = options

      this.id = id
      this.context = context ?? CREDENTIALS_CONTEXT_V2_URL
      this.type = type ?? ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE
      this.properties = properties
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ allowString: true, credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: string | Array<string | JsonObject>

  @IsDataURI()
  public id!: string

  @IsEnvelopedVerifiableCredentialType()
  public type!: SingleOrArray<string>

  @IsOptional()
  public properties?: Record<string, unknown>

  // TODO: this means it won't be validated until we access it...
  // how to solve this and ensure correct transformations?
  // Maybe replace IsDataURI above by custom validator that checks the format?
  public get credential() {
    // Only parse once!
    if (this._credential) return this._credential

    const uri = this.id
    if (!uri.startsWith('data:')) {
      throw new CredoError('Invalid Enveloped Verifiable Credential: "id" is not a valid data URI')
    }

    const mimetypeData = uri.slice(5)
    const commaIndex = mimetypeData.indexOf(',')
    if (commaIndex === -1) {
      throw new CredoError('Invalid Enveloped Verifiable Credential: "id" data URI is missing comma separator')
    }

    const mimetype = mimetypeData.slice(0, commaIndex)
    const data = mimetypeData.slice(commaIndex + 1)

    switch (mimetype) {
      case 'application/vc+sd-jwt':
        this._credential = W3cV2SdJwtVerifiableCredential.fromCompact(data)
        break

      default:
        throw new CredoError(`Unsupported Enveloped Verifiable Credential: ${mimetype} not recognized`)
    }

    return this._credential
  }
}

export function IsEnvelopedVerifiableCredentialType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsEnvelopedVerifiableCredentialType',
      validator: {
        validate: (value): boolean => {
          return Array.isArray(value)
            ? value.includes(ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE)
            : value === ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a string that equals, or an array of strings which includes "${ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE}"`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
