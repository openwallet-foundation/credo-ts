import type { ClaimFormat } from '../../W3cCredentialServiceOptions'
import type { W3cJsonLdVerifiablePresentation } from '../../data-integrity'
import type { W3cJwtVerifiablePresentation } from '../../jwt-vc'

export type W3cVerifiablePresentation<Format extends Extract<ClaimFormat, 'jwt_vp' | 'ldp_vp'> | unknown = unknown> =
  Format extends 'jwt_vp'
    ? W3cJsonLdVerifiablePresentation
    : Format extends 'ldp_vc'
    ? W3cJwtVerifiablePresentation
    : W3cJsonLdVerifiablePresentation | W3cJwtVerifiablePresentation
