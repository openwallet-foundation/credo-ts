import type { W3cVerifiableCredential, W3cVerifiablePresentation, SdJwtVc } from '@aries-framework/core'
import type {
  W3CVerifiableCredential as SphereonW3cVerifiableCredential,
  CompactSdJwtVc as SphereonCompactSdJwtVc,
  WrappedVerifiablePresentation,
} from '@sphereon/ssi-types'

import {
  JsonTransformer,
  AriesFrameworkError,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation,
  W3cJwtVerifiableCredential,
  W3cJsonLdVerifiableCredential,
  JsonEncoder,
} from '@aries-framework/core'

export function getSphereonVerifiableCredential(
  verifiableCredential: W3cVerifiableCredential | SdJwtVc
): SphereonW3cVerifiableCredential | SphereonCompactSdJwtVc {
  // encoded sd-jwt or jwt
  if (typeof verifiableCredential === 'string') {
    return verifiableCredential
  } else if (verifiableCredential instanceof W3cJsonLdVerifiableCredential) {
    return JsonTransformer.toJSON(verifiableCredential) as SphereonW3cVerifiableCredential
  } else if (verifiableCredential instanceof W3cJwtVerifiableCredential) {
    return verifiableCredential.serializedJwt
  } else {
    return verifiableCredential.compact
  }
}

export function getVerifiablePresentationFromSphereonWrapped(
  wrappedVerifiablePresentation: WrappedVerifiablePresentation
): W3cVerifiablePresentation | SdJwtVc {
  if (wrappedVerifiablePresentation.format === 'jwt_vp') {
    if (typeof wrappedVerifiablePresentation.original !== 'string') {
      throw new AriesFrameworkError('Unable to transform JWT VP to W3C VP')
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

  throw new AriesFrameworkError(`Unsupported presentation format: ${wrappedVerifiablePresentation.format}`)
}
