import type { SdJwtVc, VerifiableCredential, VerifiablePresentation } from '@credo-ts/core'
import type {
  CompactSdJwtVc as SphereonCompactSdJwtVc,
  W3CVerifiableCredential as SphereonW3cVerifiableCredential,
  W3CVerifiablePresentation as SphereonW3cVerifiablePresentation,
  WrappedVerifiablePresentation,
} from '@sphereon/ssi-types'

import {
  CredoError,
  JsonEncoder,
  JsonTransformer,
  Mdoc,
  MdocDeviceResponse,
  TypedArrayEncoder,
  W3cJsonLdVerifiableCredential,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiableCredential,
  W3cJwtVerifiablePresentation,
} from '@credo-ts/core'

export function getSphereonVerifiableCredential(
  verifiableCredential: VerifiableCredential
): SphereonW3cVerifiableCredential | SphereonCompactSdJwtVc | string {
  // encoded sd-jwt or jwt
  if (typeof verifiableCredential === 'string') {
    return verifiableCredential
  }
  if (verifiableCredential instanceof W3cJsonLdVerifiableCredential) {
    return JsonTransformer.toJSON(verifiableCredential) as SphereonW3cVerifiableCredential
  }
  if (verifiableCredential instanceof W3cJwtVerifiableCredential) {
    return verifiableCredential.serializedJwt
  }
  if (verifiableCredential instanceof Mdoc) {
    return verifiableCredential.base64Url
  }
  return verifiableCredential.compact
}

export function getSphereonVerifiablePresentation(
  verifiablePresentation: VerifiablePresentation
): SphereonW3cVerifiablePresentation | SphereonCompactSdJwtVc | string {
  // encoded sd-jwt or jwt
  if (typeof verifiablePresentation === 'string') {
    return verifiablePresentation
  }
  if (verifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
    return JsonTransformer.toJSON(verifiablePresentation) as SphereonW3cVerifiablePresentation
  }
  if (verifiablePresentation instanceof W3cJwtVerifiablePresentation) {
    return verifiablePresentation.serializedJwt
  }
  if (verifiablePresentation instanceof MdocDeviceResponse) {
    return verifiablePresentation.base64Url
  }
  return verifiablePresentation.compact
}

export function getVerifiablePresentationFromSphereonWrapped(
  wrappedVerifiablePresentation: WrappedVerifiablePresentation
): VerifiablePresentation {
  if (wrappedVerifiablePresentation.format === 'jwt_vp') {
    if (typeof wrappedVerifiablePresentation.original !== 'string') {
      throw new CredoError('Unable to transform JWT VP to W3C VP')
    }

    return W3cJwtVerifiablePresentation.fromSerializedJwt(wrappedVerifiablePresentation.original)
  }
  if (wrappedVerifiablePresentation.format === 'ldp_vp') {
    return JsonTransformer.fromJSON(wrappedVerifiablePresentation.original, W3cJsonLdVerifiablePresentation)
  }
  if (wrappedVerifiablePresentation.format === 'vc+sd-jwt') {
    // We use some custom logic here so we don't have to re-process the encoded SD-JWT
    const [encodedHeader] = wrappedVerifiablePresentation.presentation.compactSdJwtVc.split('.')
    const header = JsonEncoder.fromBase64(encodedHeader)
    return {
      compact: wrappedVerifiablePresentation.presentation.compactSdJwtVc,
      header,
      payload: wrappedVerifiablePresentation.presentation.signedPayload,
      prettyClaims: wrappedVerifiablePresentation.presentation.decodedPayload,
    } satisfies SdJwtVc
  }
  if (wrappedVerifiablePresentation.format === 'mso_mdoc') {
    if (typeof wrappedVerifiablePresentation.original !== 'string') {
      const base64Url = TypedArrayEncoder.toBase64URL(
        new Uint8Array(wrappedVerifiablePresentation.original.cborEncode())
      )
      return MdocDeviceResponse.fromBase64Url(base64Url)
    }
    return MdocDeviceResponse.fromBase64Url(wrappedVerifiablePresentation.original)
  }

  throw new CredoError(`Unsupported presentation format: ${wrappedVerifiablePresentation.format}`)
}
