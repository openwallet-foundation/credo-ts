import type { SdJwtVc, VerifiablePresentation, VerifiableCredential } from '@credo-ts/core'
import type {
  W3CVerifiableCredential as SphereonW3cVerifiableCredential,
  W3CVerifiablePresentation as SphereonW3cVerifiablePresentation,
  CompactSdJwtVc as SphereonCompactSdJwtVc,
  WrappedVerifiablePresentation,
} from '@sphereon/ssi-types'

import {
  JsonTransformer,
  CredoError,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation,
  W3cJwtVerifiableCredential,
  W3cJsonLdVerifiableCredential,
  JsonEncoder,
  Mdoc,
} from '@credo-ts/core'
import { MdocVerifiablePresentation } from '@sphereon/did-auth-siop'

export function getSphereonVerifiableCredential(
  verifiableCredential: VerifiableCredential
): SphereonW3cVerifiableCredential | SphereonCompactSdJwtVc {
  // encoded sd-jwt or jwt
  if (typeof verifiableCredential === 'string') {
    return verifiableCredential
  } else if (verifiableCredential instanceof W3cJsonLdVerifiableCredential) {
    return JsonTransformer.toJSON(verifiableCredential) as SphereonW3cVerifiableCredential
  } else if (verifiableCredential instanceof W3cJwtVerifiableCredential) {
    return verifiableCredential.serializedJwt
  } else if (verifiableCredential instanceof Mdoc) {
    throw new CredoError('Issuance side for Mdoc not yet implemented.')
  } else {
    return verifiableCredential.compact
  }
}

export function getSphereonVerifiablePresentation(
  verifiablePresentation: VerifiablePresentation | MdocVerifiablePresentation
): SphereonW3cVerifiablePresentation | SphereonCompactSdJwtVc {
  // encoded sd-jwt or jwt
  if (typeof verifiablePresentation === 'string') {
    return verifiablePresentation
    // todo: check why instanceof MdocVerifiablePresentation is not working
  } else if (
    verifiablePresentation instanceof MdocVerifiablePresentation ||
    ('format' in verifiablePresentation && verifiablePresentation.format === 'mso_mdoc')
  ) {
    return (verifiablePresentation as MdocVerifiablePresentation).deviceSignedBase64Url
  } else if (verifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
    return JsonTransformer.toJSON(verifiablePresentation) as SphereonW3cVerifiablePresentation
  } else if (verifiablePresentation instanceof W3cJwtVerifiablePresentation) {
    return verifiablePresentation.serializedJwt
  } else {
    return verifiablePresentation.compact
  }
}

export function getVerifiablePresentationFromSphereonWrapped(
  wrappedVerifiablePresentation: WrappedVerifiablePresentation | MdocVerifiablePresentation
): VerifiablePresentation | MdocVerifiablePresentation {
  if (wrappedVerifiablePresentation instanceof MdocVerifiablePresentation) {
    return wrappedVerifiablePresentation
  } else if (wrappedVerifiablePresentation.format === 'jwt_vp') {
    if (typeof wrappedVerifiablePresentation.original !== 'string') {
      throw new CredoError('Unable to transform JWT VP to W3C VP')
    }

    return W3cJwtVerifiablePresentation.fromSerializedJwt(wrappedVerifiablePresentation.original)
  } else if (wrappedVerifiablePresentation.format === 'ldp_vp') {
    return JsonTransformer.fromJSON(wrappedVerifiablePresentation.original, W3cJsonLdVerifiablePresentation)
  } else if (wrappedVerifiablePresentation.format === 'vc+sd-jwt') {
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

  throw new CredoError(`Unsupported presentation format: ${wrappedVerifiablePresentation.format}`)
}
