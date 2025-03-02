import type { W3cJsonLdVerifiablePresentation } from '../../data-integrity'
import type { W3cJwtVerifiablePresentation } from '../../jwt-vc'
import type { ClaimFormat } from '../ClaimFormat'

export type W3cVerifiablePresentation<Format extends ClaimFormat.JwtVp | ClaimFormat.LdpVp | unknown = unknown> =
  Format extends ClaimFormat.JwtVp
    ? W3cJwtVerifiablePresentation
    : Format extends ClaimFormat.LdpVp
      ? W3cJsonLdVerifiablePresentation
      : W3cJsonLdVerifiablePresentation | W3cJwtVerifiablePresentation
