import type { W3cVerifiableCredential, W3cVerifiablePresentation } from '../../vc'
import type {
  OriginalVerifiableCredential as SphereonOriginalVerifiableCredential,
  W3CVerifiableCredential as SphereonW3cVerifiableCredential,
  W3CVerifiablePresentation as SphereonW3cVerifiablePresentation,
} from '@sphereon/ssi-types'

import { JsonTransformer } from '../../../utils'
import {
  W3cJsonLdVerifiableCredential,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiableCredential,
  W3cJwtVerifiablePresentation,
  ClaimFormat,
} from '../../vc'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'

export function getSphereonOriginalVerifiableCredential(
  w3cVerifiableCredential: W3cVerifiableCredential
): SphereonOriginalVerifiableCredential {
  if (w3cVerifiableCredential.claimFormat === ClaimFormat.LdpVc) {
    return JsonTransformer.toJSON(w3cVerifiableCredential) as SphereonOriginalVerifiableCredential
  } else if (w3cVerifiableCredential.claimFormat === ClaimFormat.JwtVc) {
    return w3cVerifiableCredential.serializedJwt
  } else {
    throw new DifPresentationExchangeError(
      `Unsupported claim format. Only ${ClaimFormat.LdpVc} and ${ClaimFormat.JwtVc} are supported.`
    )
  }
}

export function getSphereonW3cVerifiableCredential(
  w3cVerifiableCredential: W3cVerifiableCredential
): SphereonW3cVerifiableCredential {
  if (w3cVerifiableCredential.claimFormat === ClaimFormat.LdpVc) {
    return JsonTransformer.toJSON(w3cVerifiableCredential) as SphereonW3cVerifiableCredential
  } else if (w3cVerifiableCredential.claimFormat === ClaimFormat.JwtVc) {
    return w3cVerifiableCredential.serializedJwt
  } else {
    throw new DifPresentationExchangeError(
      `Unsupported claim format. Only ${ClaimFormat.LdpVc} and ${ClaimFormat.JwtVc} are supported.`
    )
  }
}

export function getSphereonW3cVerifiablePresentation(
  w3cVerifiablePresentation: W3cVerifiablePresentation
): SphereonW3cVerifiablePresentation {
  if (w3cVerifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
    return JsonTransformer.toJSON(w3cVerifiablePresentation) as SphereonW3cVerifiablePresentation
  } else if (w3cVerifiablePresentation instanceof W3cJwtVerifiablePresentation) {
    return w3cVerifiablePresentation.serializedJwt
  } else {
    throw new DifPresentationExchangeError(
      `Unsupported claim format. Only ${ClaimFormat.LdpVc} and ${ClaimFormat.JwtVc} are supported.`
    )
  }
}

export function getW3cVerifiablePresentationInstance(
  w3cVerifiablePresentation: SphereonW3cVerifiablePresentation
): W3cVerifiablePresentation {
  if (typeof w3cVerifiablePresentation === 'string') {
    return W3cJwtVerifiablePresentation.fromSerializedJwt(w3cVerifiablePresentation)
  } else {
    return JsonTransformer.fromJSON(w3cVerifiablePresentation, W3cJsonLdVerifiablePresentation)
  }
}

export function getW3cVerifiableCredentialInstance(
  w3cVerifiableCredential: SphereonW3cVerifiableCredential
): W3cVerifiableCredential {
  if (typeof w3cVerifiableCredential === 'string') {
    return W3cJwtVerifiableCredential.fromSerializedJwt(w3cVerifiableCredential)
  } else {
    return JsonTransformer.fromJSON(w3cVerifiableCredential, W3cJsonLdVerifiableCredential)
  }
}
