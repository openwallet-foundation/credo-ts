import type { HashName } from '../../crypto'
import type { KnownJwaSignatureAlgorithm } from '../kms'
import type { IDisclosureFrame, IPresentationFrame, SdJwtVcHolderBinding } from '../sd-jwt-vc'
import type {
  W3cV2DataIntegrityVerifiableCredential,
  W3cV2DataIntegrityVerifiablePresentation,
} from './data-integrity-v1'
import { W3cV2JwtVerifiableCredential, W3cV2JwtVerifiablePresentation } from './jwt-vc'
import type { ClaimFormat, W3cV2Credential, W3cV2Presentation } from './models'
import type { W3cV2CredentialRecord } from './repository'
import { W3cV2SdJwtVerifiableCredential, W3cV2SdJwtVerifiablePresentation } from './sd-jwt-vc'

export type W3cV2SignCredentialOptions<
  Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | ClaimFormat.DiVc | undefined = undefined,
> = Format extends ClaimFormat.JwtW3cVc
  ? W3cV2JwtSignCredentialOptions
  : Format extends ClaimFormat.SdJwtW3cVc
    ? W3cV2SdJwtSignCredentialOptions
    : Format extends ClaimFormat.DiVc
      ? W3cV2DiSignCredentialOptions
      : W3cV2JwtSignCredentialOptions | W3cV2SdJwtSignCredentialOptions | W3cV2DiSignCredentialOptions

export type W3cV2VerifyCredentialOptions<
  Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc | ClaimFormat.DiVc | undefined = undefined,
> = Format extends ClaimFormat.JwtW3cVc
  ? W3cV2JwtVerifyCredentialOptions
  : Format extends ClaimFormat.SdJwtW3cVc
    ? W3cV2SdJwtVerifyCredentialOptions
    : Format extends ClaimFormat.DiVc
      ? W3cV2DiVerifyCredentialOptions
      : W3cV2JwtVerifyCredentialOptions | W3cV2SdJwtVerifyCredentialOptions | W3cV2DiVerifyCredentialOptions

export type W3cV2SignPresentationOptions<
  Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp | ClaimFormat.DiVp | undefined = undefined,
> = Format extends ClaimFormat.JwtW3cVp
  ? W3cV2JwtSignPresentationOptions
  : Format extends ClaimFormat.SdJwtW3cVp
    ? W3cV2SdJwtSignPresentationOptions
    : Format extends ClaimFormat.DiVp
      ? W3cV2DiSignPresentationOptions
      : W3cV2JwtSignPresentationOptions | W3cV2SdJwtSignPresentationOptions | W3cV2DiSignPresentationOptions

export type W3cV2VerifyPresentationOptions =
  | W3cV2JwtVerifyPresentationOptions
  | W3cV2SdJwtVerifyPresentationOptions
  | W3cV2DiVerifyPresentationOptions

interface W3cV2SignCredentialOptionsBase {
  /**
   * The format of the credential to be signed.
   *
   * @see https://identity.foundation/claim-format-registry
   */
  format: ClaimFormat

  /**
   * The credential to be signed.
   */
  credential: W3cV2Credential

  /**
   * URI of the verificationMethod to be used for signing the credential.
   *
   * Must be a valid did url pointing to a key.
   */
  verificationMethod: string
}

export interface W3cV2JwtSignCredentialOptions extends W3cV2SignCredentialOptionsBase {
  format: ClaimFormat.JwtW3cVc

  /**
   * The algorithm used to sign the JWT VC.
   */
  alg: KnownJwaSignatureAlgorithm

  /**
   * The holder to bind the credential to. When an holder is provided, a `cnf`
   * claim will be added to the produced credential, binding it to the holder.
   */
  holder?: SdJwtVcHolderBinding
}

export interface W3cV2SdJwtSignCredentialOptions extends W3cV2SignCredentialOptionsBase {
  format: ClaimFormat.SdJwtW3cVc

  /**
   * The algorithm used to sign the SD-JWT VC.
   */
  alg: KnownJwaSignatureAlgorithm

  /**
   * The hashing algorithm to use for creating digests of the disclosures.
   *
   * @default 'sha-256'
   */
  hashingAlgorithm?: Exclude<HashName, 'sha-1'>

  /**
   * The holder to bind the credential to. When an holder is provided, a `cnf`
   * claim will be added to the produced credential, binding it to the holder.
   */
  holder?: SdJwtVcHolderBinding

  /**
   * Disclosure frame defining which claims should be selectively disclosable.
   * If not provided, all claims will be disclosable.
   */
  disclosureFrame?: IDisclosureFrame
}

interface W3cV2VerifyCredentialOptionsBase {
  credential: unknown
}

export interface W3cV2JwtVerifyCredentialOptions extends W3cV2VerifyCredentialOptionsBase {
  credential: W3cV2JwtVerifiableCredential | string // string must be encoded VC JWT
}

export interface W3cV2SdJwtVerifyCredentialOptions extends W3cV2VerifyCredentialOptionsBase {
  credential: W3cV2SdJwtVerifiableCredential | string // string must be encoded VC SD-JWT
}

interface W3cV2SignPresentationOptionsBase {
  /**
   * The format of the presentation to be signed.
   *
   * @see https://identity.foundation/claim-format-registry
   */
  format: ClaimFormat

  /**
   * The presentation to be signed.
   */
  presentation: W3cV2Presentation

  /**
   * The challenge / nonce to be used in the proof to prevent replay attacks.
   */
  challenge: string

  /**
   * The domain / aud to be used in the proof to assert the intended recipient.
   */
  domain?: string
}

export interface W3cV2JwtSignPresentationOptions extends W3cV2SignPresentationOptionsBase {
  format: ClaimFormat.JwtW3cVp
}

export interface W3cV2SdJwtSignPresentationOptions extends W3cV2SignPresentationOptionsBase {
  format: ClaimFormat.SdJwtW3cVp

  /**
   * The hashing algorithm to use for creating digests of the disclosures.
   *
   * @default 'sha-256'
   */
  hashingAlgorithm?: Exclude<HashName, 'sha-1'>

  /**
   * Disclosure frame defining which claims should be selectively disclosable.
   * If not provided, all claims will be disclosable.
   */
  disclosureFrame?: IDisclosureFrame
}

interface W3cV2VerifyPresentationOptionsBase {
  /**
   * The presentation to be verified.
   */
  presentation: unknown

  /**
   * The challenge / nonce that must present in the presentation prevent replay attacks.
   */
  challenge: string

  /**
   * The domain / aud to be used in the proof to assert the intended recipient.
   */
  domain?: string
}

export interface W3cV2JwtVerifyPresentationOptions extends W3cV2VerifyPresentationOptionsBase {
  presentation: W3cV2JwtVerifiablePresentation | string // string must be encoded VP JWT
}

export interface W3cV2SdJwtVerifyPresentationOptions extends W3cV2VerifyPresentationOptionsBase {
  presentation: W3cV2SdJwtVerifiablePresentation | string // string must be encoded VP SD-JWT
}

export interface W3cV2StoreCredentialOptions {
  record: W3cV2CredentialRecord
}

export interface W3cV2SdJwtVcPresentOptions {
  credential: W3cV2SdJwtVerifiableCredential | string

  /**
   * Use true to disclose everything
   */
  presentationFrame?: IPresentationFrame | true
}

/**
 * Data Integrity (di_vc) credential signing options
 */
export interface W3cV2DiSignCredentialOptions extends W3cV2SignCredentialOptionsBase {
  format: ClaimFormat.DiVc

  /**
   * The cryptosuite to use for signing (e.g., 'eddsa-jcs-2022')
   */
  cryptosuite: string
}

/**
 * Data Integrity (di_vc) credential verification options
 */
export interface W3cV2DiVerifyCredentialOptions extends W3cV2VerifyCredentialOptionsBase {
  credential: W3cV2DataIntegrityVerifiableCredential
}

/**
 * Data Integrity (di_vp) presentation signing options
 */
export interface W3cV2DiSignPresentationOptions extends W3cV2SignPresentationOptionsBase {
  format: ClaimFormat.DiVp

  /**
   * URI of the verificationMethod to be used for signing the presentation proof.
   *
   * Must be a valid did url pointing to a key.
   */
  verificationMethod: string

  /**
   * The cryptosuite to use for signing (e.g., 'eddsa-jcs-2022')
   */
  cryptosuite: string
}

/**
 * Data Integrity (di_vp) presentation verification options
 */
export interface W3cV2DiVerifyPresentationOptions extends W3cV2VerifyPresentationOptionsBase {
  presentation: W3cV2DataIntegrityVerifiablePresentation
}
