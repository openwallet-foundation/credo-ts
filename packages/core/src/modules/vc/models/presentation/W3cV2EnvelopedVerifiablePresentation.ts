import { Exclude, Expose } from 'class-transformer'
import { buildMessage, IsDataURI, ValidateBy, type ValidationOptions } from 'class-validator'
import { CredoError } from '../../../../error'
import type { JsonObject, SingleOrArray } from '../../../../types'
import {
  CREDENTIALS_CONTEXT_V2_URL,
  ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE,
  ENVELOPED_VERIFIABLE_PRESENTATION_TYPE,
} from '../../constants'
import { W3cV2JwtVerifiablePresentation } from '../../jwt-vc'
import { W3cV2SdJwtVerifiablePresentation } from '../../sd-jwt-vc'
import { IsCredentialJsonLdContext } from '../../validators'
import { ClaimFormat } from '../ClaimFormat'
import { W3cV2Presentation } from './W3cV2Presentation'

export interface W3cV2EnvelopedVerifiablePresentationOptions {
  id: string
  context?: string | Array<string | JsonObject>
  type?: SingleOrArray<string>
}

export class W3cV2EnvelopedVerifiablePresentation {
  @Exclude()
  private _envelopedPresentation?: W3cV2SdJwtVerifiablePresentation | W3cV2JwtVerifiablePresentation

  public constructor(options: W3cV2EnvelopedVerifiablePresentationOptions) {
    if (options) {
      this.context = options.context ?? CREDENTIALS_CONTEXT_V2_URL
      this.id = options.id
      this.type = options.type ?? ENVELOPED_VERIFIABLE_CREDENTIAL_TYPE
      this._envelopedPresentation = presentationFromDataUri(options.id)
    }
  }

  public static fromVerifiablePresentation(
    presentation: W3cV2SdJwtVerifiablePresentation | W3cV2JwtVerifiablePresentation
  ): W3cV2EnvelopedVerifiablePresentation {
    return new W3cV2EnvelopedVerifiablePresentation({
      id: presentationToDataUri(presentation),
      context: CREDENTIALS_CONTEXT_V2_URL,
      type: ENVELOPED_VERIFIABLE_PRESENTATION_TYPE,
    })
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ allowString: true, credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: string | Array<string | JsonObject>

  @IsDataURI()
  public id!: string

  @IsEnvelopedVerifiablePresentationType()
  public type!: SingleOrArray<string>

  /**
   * Gets the enveloped presentation.
   */
  public get envelopedPresentation() {
    if (!this._envelopedPresentation) {
      this._envelopedPresentation = presentationFromDataUri(this.id)
    }

    return this._envelopedPresentation
  }

  /**
   * Resolved presentation is the fully resolved {@link W3cV2Presentation} instance.
   */
  public get resolvedPresentation(): W3cV2Presentation {
    return this.envelopedPresentation.resolvedPresentation
  }

  /**
   * The {@link ClaimFormat} of the enveloped presentation.
   */
  public get claimFormat(): ClaimFormat.SdJwtW3cVp | ClaimFormat.JwtW3cVp {
    return this.envelopedPresentation.claimFormat
  }
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

function presentationFromDataUri(uri: string) {
  if (!uri.startsWith('data:')) {
    throw new CredoError('Invalid Enveloped Verifiable Presentation: "id" is not a valid data URI')
  }

  const mimetypeData = uri.slice(5)
  const commaIndex = mimetypeData.indexOf(',')
  if (commaIndex === -1) {
    throw new CredoError('Invalid Enveloped Verifiable Presentation: "id" data URI is missing comma separator')
  }

  const mimetype = mimetypeData.slice(0, commaIndex)
  const data = mimetypeData.slice(commaIndex + 1)

  switch (mimetype) {
    case 'application/vp+sd-jwt':
      return W3cV2SdJwtVerifiablePresentation.fromCompact(data)

    case 'application/vp+jwt':
      return W3cV2JwtVerifiablePresentation.fromCompact(data)

    default:
      throw new CredoError(`Unsupported Enveloped Verifiable Presentation: ${mimetype} not recognized`)
  }
}

function presentationToDataUri(presentation: W3cV2SdJwtVerifiablePresentation | W3cV2JwtVerifiablePresentation) {
  if (presentation instanceof W3cV2SdJwtVerifiablePresentation) {
    return `data:application/vp+sd-jwt,${presentation.encoded}`
  }

  if (presentation instanceof W3cV2JwtVerifiablePresentation) {
    return `data:application/vp+jwt,${presentation.encoded}`
  }

  throw new CredoError('Unsupported Verifiable Presentation instance')
}
