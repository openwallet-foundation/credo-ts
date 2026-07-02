import type {
  JwtPayload,
  Mdoc,
  SdJwtVc,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2JwtVerifiableCredential,
  W3cV2SdJwtVerifiableCredential,
} from '@credo-ts/core'
import type { OpenId4VcIssuanceSessionRecord } from '../openid4vc-issuer/repository'
import type { OpenId4VcVerificationSessionRecord } from '../openid4vc-verifier/repository'

export type OpenId4VcVerificationTypeOauth2SecuredAuthorizationRequest = {
  type: 'oauth2SecuredAuthorizationRequest'
  authorizationRequest: {
    jwt: string
    payload: JwtPayload
  }
}

export type OpenId4VcVerificationTypeOpenId4VciKeyAttestation = {
  type: 'openId4VciKeyAttestation'
  openId4VcIssuanceSessionRecord: OpenId4VcIssuanceSessionRecord
  keyAttestation: {
    jwt: string
    payload: JwtPayload
  }
}

export type OpenId4VcVerificationTypeOpenId4VciCredentialIssuerMetadata = {
  type: 'openId4VciCredentialIssuerMetadata'
  credentialIssuerMetadata: {
    jwt: string
    payload: JwtPayload
  }
}

export type OpenId4VcVerificationTypeOauth2ClientAttestation = {
  type: 'oauth2ClientAttestation'
  openId4VcIssuanceSessionRecord: OpenId4VcIssuanceSessionRecord
  clientAttestation: {
    jwt: string
    payload: JwtPayload
  }
}

/**
 * Credential verification bound to an OpenID4VP verification session.
 * Use this instead of the core `VerificationTypeCredential` when the credential
 * is verified as part of an OpenID4VP presentation flow.
 */
export type OpenId4VcVerificationTypeOid4VpCredential = {
  type: 'openId4VpCredential'
  openId4VcVerificationSessionRecord: OpenId4VcVerificationSessionRecord
  credential:
    | SdJwtVc
    | Mdoc
    | W3cJsonLdVerifiableCredential
    | W3cJwtVerifiableCredential
    | W3cV2JwtVerifiableCredential
    | W3cV2SdJwtVerifiableCredential
}

/**
 * Union of all OpenID4VC-specific verification types. Pass this as the additional verification
 * types generic parameter to `GetTrustedIssuersForVerification` to get full type coverage:
 *
 * ```ts
 * const getTrustedIssuersForVerification: GetTrustedIssuersForVerification<
 *   VerificationSigner,
 *   OpenId4VcVerificationTypes
 * > = async (agentContext, { verification, signer }) => { ... }
 * ```
 */
export type OpenId4VcVerificationTypes =
  | OpenId4VcVerificationTypeOauth2SecuredAuthorizationRequest
  | OpenId4VcVerificationTypeOpenId4VciKeyAttestation
  | OpenId4VcVerificationTypeOpenId4VciCredentialIssuerMetadata
  | OpenId4VcVerificationTypeOauth2ClientAttestation
  | OpenId4VcVerificationTypeOid4VpCredential
