import { W3cV2JwtVerifiablePresentation, type W3cV2JwtVerifiablePresentationOptions } from '../../jwt-vc'
import { W3cV2SdJwtVerifiablePresentation, type W3cV2SdJwtVerifiablePresentationOptions } from '../../sd-jwt-vc'
import { ClaimFormat } from '../ClaimFormat'

/**
 * A Secured W3C Verifiable Presentation (VP) as defined in the W3C VC Data Model 2.0
 * and secured according to the VC-JOSE-COSE specification.
 *
 * It can be one of:
 * - An Verifiable Presentation encoded as a JWT.
 * - An Verifiable Presentation encoded as a SD-JWT.
 *
 * This can be further enveloped using a {@link W3cV2EnvelopedVerifiablePresentation}.
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 * @see https://www.w3.org/TR/vc-jose-cose/
 *
 * TODO: add support for embedded proof mechanisms (Verifiable Credential Data Integrity 1.0)
 */
export type W3cV2VerifiablePresentation<
  Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | unknown = unknown,
> = Format extends ClaimFormat.JwtW3cVp
  ? W3cV2JwtVerifiablePresentation
  : Format extends ClaimFormat.SdJwtW3cVp
    ? W3cV2SdJwtVerifiablePresentation
    : W3cV2SdJwtVerifiablePresentation | W3cV2JwtVerifiablePresentation

export type W3cV2VerifiablePresentationOptions<
  Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | unknown = unknown,
> = Format extends ClaimFormat.JwtW3cVp
  ? W3cV2JwtVerifiablePresentationOptions
  : Format extends ClaimFormat.SdJwtW3cVp
    ? W3cV2SdJwtVerifiablePresentationOptions
    : W3cV2SdJwtVerifiablePresentationOptions | W3cV2JwtVerifiablePresentationOptions
