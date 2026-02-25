import { Exclude, Expose, instanceToPlain, plainToInstance, Transform, TransformationType } from 'class-transformer'
import { buildMessage, IsDataURI, isInstance, ValidateBy, type ValidationOptions } from 'class-validator'
import { CredoError } from '../../../../error'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { CREDENTIALS_CONTEXT_V2_URL, ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE } from '../../constants'
import { W3cV2JwtVerifiableCredential } from '../../jwt-vc/W3cV2JwtVerifiableCredential'
import { W3cV2SdJwtVerifiableCredential } from '../../sd-jwt-vc/W3cV2SdJwtVerifiableCredential'
import { IsCredentialJsonLdContext } from '../../validators'
import { ClaimFormat } from '../ClaimFormat'
import { W3cV2Credential } from './W3cV2Credential'

export interface W3cV2EnvelopedVerifiableCredentialOptions {
  id: string
  context?: string | Array<string | JsonObject>
  type?: SingleOrArray<string>
}

export class W3cV2EnvelopedVerifiableCredential {
  @Exclude()
  private _envelopedCredential?: W3cV2SdJwtVerifiableCredential | W3cV2JwtVerifiableCredential

  public constructor(options: W3cV2EnvelopedVerifiableCredentialOptions) {
    if (options) {
      this.context = options.context ?? CREDENTIALS_CONTEXT_V2_URL
      this.id = options.id
      this.type = options.type ?? ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE
      this._envelopedCredential = credentialFromDataUri(options.id)
    }
  }

  public static fromVerifiableCredential(
    credential: W3cV2SdJwtVerifiableCredential | W3cV2JwtVerifiableCredential
  ): W3cV2EnvelopedVerifiableCredential {
    return new W3cV2EnvelopedVerifiableCredential({
      id: credentialToDataUri(credential),
      context: CREDENTIALS_CONTEXT_V2_URL,
      type: ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE,
    })
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ allowString: true, credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: string | Array<string | JsonObject>

  @IsDataURI()
  public id!: string

  @IsEnvelopedVerifiableCredentialType()
  public type!: SingleOrArray<string>

  /**
   * Gets the enveloped credential.
   */
  public get envelopedCredential() {
    if (!this._envelopedCredential) {
      this._envelopedCredential = credentialFromDataUri(this.id)
    }

    return this._envelopedCredential
  }

  /**
   * Resolved credential is the fully resolved {@link W3cV2Credential} instance.
   */
  public get resolvedCredential(): W3cV2Credential {
    return this.envelopedCredential.resolvedCredential
  }

  /**
   * The {@link ClaimFormat} of the enveloped credential.
   */
  public get claimFormat(): ClaimFormat.SdJwtW3cVc | ClaimFormat.JwtW3cVc {
    return this.envelopedCredential.claimFormat
  }
}

const jsonToClass = (v: unknown) => {
  if (!v || typeof v !== 'object') {
    throw new CredoError('Invalid plain W3cV2EnvelopedVerifiableCredential')
  }

  if (isInstance(v, W3cV2EnvelopedVerifiableCredential)) {
    return v
  }

  return plainToInstance(W3cV2EnvelopedVerifiableCredential, v)
}

const classToJson = (v: unknown) => {
  return instanceToPlain(v)
}

export function W3cV2EnvelopedVerifiableCredentialTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<unknown>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return Array.isArray(value) ? value.map(jsonToClass) : jsonToClass(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map(classToJson)
      return classToJson(value)
    }

    // PLAIN_TO_PLAIN
    return value
  })
}

export function IsEnvelopedVerifiableCredentialType(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsEnvelopedVerifiableCredentialType',
      validator: {
        validate: (value): boolean => {
          return Array.isArray(value)
            ? value.includes(ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE) && value.every((v) => typeof v === 'string')
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

function credentialFromDataUri(uri: string) {
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
      return W3cV2SdJwtVerifiableCredential.fromCompact(data)

    case 'application/vc+jwt':
      return W3cV2JwtVerifiableCredential.fromCompact(data)

    default:
      throw new CredoError(`Unsupported Enveloped Verifiable Credential: ${mimetype} not recognized`)
  }
}

function credentialToDataUri(presentation: W3cV2SdJwtVerifiableCredential | W3cV2JwtVerifiableCredential) {
  if (presentation instanceof W3cV2SdJwtVerifiableCredential) {
    return `data:application/vc+sd-jwt,${presentation.encoded}`
  }

  if (presentation instanceof W3cV2JwtVerifiableCredential) {
    return `data:application/vc+jwt,${presentation.encoded}`
  }

  throw new CredoError('Unsupported Verifiable Credential instance')
}
