import { CredoError } from '../../../../error'
import { W3cV2JwtVerifiablePresentation } from '../../jwt-vc/W3cV2JwtVerifiablePresentation'
import { W3cV2SdJwtVerifiablePresentation } from '../../sd-jwt-vc/W3cV2SdJwtVerifiablePresentation'

export function presentationFromDataUri(uri: string) {
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

export function presentationToDataUri(presentation: W3cV2SdJwtVerifiablePresentation | W3cV2JwtVerifiablePresentation) {
  if (presentation instanceof W3cV2SdJwtVerifiablePresentation) {
    return `data:application/vp+sd-jwt,${presentation.encoded}`
  }

  if (presentation instanceof W3cV2JwtVerifiablePresentation) {
    return `data:application/vp+jwt,${presentation.encoded}`
  }

  throw new CredoError('Unsupported Verifiable Presentation instance')
}
