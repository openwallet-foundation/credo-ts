import type { JwaSignatureAlgorithm, KeyType, VerificationMethod } from '@aries-framework/core'

import { ClaimFormat } from '@aries-framework/core'

/**
 * The credential formats that are supported by the openid4vc client
 */
export type SupportedCredentialFormats = ClaimFormat.JwtVc | ClaimFormat.LdpVc
export const supportedCredentialFormats = [ClaimFormat.JwtVc, ClaimFormat.LdpVc] satisfies SupportedCredentialFormats[]

/**
 * Options that are used for the pre-authorized code flow.
 */
export interface PreAuthCodeFlowOptions {
  issuerUri: string
  verifyCredentialStatus: boolean

  /**
   * A list of allowed credential formats in order of preference.
   *
   * If the issuer supports one of the allowed formats, that first format that is supported
   * from the list will be used.
   *
   * If the issuer doesn't support any of the allowed formats, an error is thrown
   * and the request is aborted.
   */
  allowedCredentialFormats?: SupportedCredentialFormats[]

  /**
   * A list of allowed proof of possession signature algorithms in order of preference.
   *
   * Note that the signature algorithms must be supported by the wallet implementation.
   * Signature algorithms that are not supported by the wallet will be ignored.
   *
   * The proof of possession (pop) signature algorithm is used in the credential request
   * to bind the credential to a did. In most cases the JWA signature algorithm
   * that is used in the pop will determine the cryptographic suite that is used
   * for signing the credential, but this not a requirement for the spec. E.g. if the
   * pop uses EdDsa, the credential will most commonly also use EdDsa, or Ed25519Signature2018/2020.
   */
  allowedProofOfPossessionSignatureAlgorithms?: JwaSignatureAlgorithm[]

  /**
   * A function that should resolve a verification method based on the options passed.
   * This method will be called once for each of the credentials that are included
   * in the credential offer.
   *
   * Based on the credential format, JWA signature algorithm, verification method types
   * and did methods, the resolver must return a verification method that will be used
   * for the proof of possession signature.
   */
  proofOfPossessionVerificationMethodResolver: ProofOfPossessionVerificationMethodResolver
}

/**
 * Options that are used for the authorization code flow.
 * Extends the pre-authorized code flow options.
 */
export interface AuthCodeFlowOptions extends PreAuthCodeFlowOptions {
  clientId: string
  authorizationCode: string
  codeVerifier: string
  redirectUri: string
}

/**
 * The options that are used to generate the authorization url.
 *
 * NOTE: The `code_challenge` property is omitted here
 * because we assume it will always be SHA256
 * as clear text code challenges are unsafe.
 */
export interface GenerateAuthorizationUrlOptions {
  initiationUri: string
  clientId: string
  redirectUri: string
  scope?: string[]
}

export interface ProofOfPossessionVerificationMethodResolverOptions {
  /**
   * The credential format that will be requested from the issuer.
   * E.g. `jwt_vc` or `ldp_vc`.
   */
  credentialFormat: SupportedCredentialFormats

  /**
   * The JWA Signature Algorithm that will be used in the proof of possession.
   * This is based on the `allowedProofOfPossessionSignatureAlgorithms` passed
   * to the request credential method, and the supported signature algorithms.
   */
  proofOfPossessionSignatureAlgorithm: JwaSignatureAlgorithm

  /**
   * This is a list of verification methods types that are supported
   * for creating the proof of possession signature. The returned
   * verification method type must be of one of these types.
   */
  supportedVerificationMethods: string[]

  /**
   * The key type that will be used to create the proof of possession signature.
   * This is related to the verification method and the signature algorithm, and
   * is added for convenience.
   */
  keyType: KeyType

  /**
   * The credential type that will be requested from the issuer. This is
   * based on the credential types that are included the credential offer.
   */
  credentialType: string

  /**
   * Whether the issuer supports the `did` cryptographic binding method,
   * indicating they support all did methods. In most cases, they do not
   * support all did methods, and it means we have to make an assumption
   * about the did methods they support.
   *
   * If this value is `false`, the `supportedDidMethods` property will
   * contain a list of supported did methods.
   */
  supportsAllDidMethods: boolean

  /**
   * A list of supported did methods. This is only used if the `supportsAllDidMethods`
   * property is `false`. When this array is populated, the returned verification method
   * MUST be based on one of these did methods.
   *
   * The did methods are returned in the format `did:<method>`, e.g. `did:web`.
   */
  supportedDidMethods: string[]
}

/**
 * The proof of possession verification method resolver is a function that can be passed by the
 * user of the framework and allows them to determine which verification method should be used
 * for the proof of possession signature.
 */
export type ProofOfPossessionVerificationMethodResolver = (
  options: ProofOfPossessionVerificationMethodResolverOptions
) => Promise<VerificationMethod> | VerificationMethod

/**
 * @internal
 */
export interface ProofOfPossessionRequirements {
  credentialFormat: SupportedCredentialFormats
  signatureAlgorithm: JwaSignatureAlgorithm
  supportedDidMethods: string[]
  supportsAllDidMethods: boolean
}

/**
 * @internal
 */
export enum AuthFlowType {
  AuthorizationCodeFlow,
  PreAuthorizedCodeFlow,
}

type WithFlowType<FlowType extends AuthFlowType, Options> = Options & { flowType: FlowType }

/**
 * The options that are used to request a credential from an issuer.
 * @internal
 */
export type RequestCredentialOptions =
  | WithFlowType<AuthFlowType.PreAuthorizedCodeFlow, PreAuthCodeFlowOptions>
  | WithFlowType<AuthFlowType.AuthorizationCodeFlow, AuthCodeFlowOptions>
