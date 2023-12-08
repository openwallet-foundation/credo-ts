import type { AgentContext, VerificationMethod, W3cCredential } from '@aries-framework/core'
import type { SdJwtCredential } from '@aries-framework/sd-jwt-vc'
import type {
  CNonceState,
  CredentialOfferFormat,
  CredentialOfferPayloadV1_0_11,
  CredentialOfferSession,
  CredentialRequestV1_0_11,
  CredentialSupported,
  MetadataDisplay,
  ProofOfPossession,
} from '@sphereon/oid4vci-common'

export type { MetadataDisplay, ProofOfPossession, CredentialSupported, CredentialOfferFormat }

// If the entry is an object, the object contains the data related to a certain credential type
// the Wallet MAY request. Each object MUST contain a format Claim determining the format
// and further parameters characterizing by the format of the credential to be requested.
export type OfferedCredential = CredentialOfferFormat | string

export type PreAuthorizedCodeFlowConfig = {
  preAuthorizedCode?: string
  userPinRequired?: boolean
}

export type AuthorizationCodeFlowConfig = {
  issuerState?: string
}

export type IssuerMetadata = {
  // The Credential Issuer's identifier. (URL using the https scheme)
  issuerBaseUrl: string
  credentialEndpointPath: string
  tokenEndpointPath: string
  authorizationServerUrl?: string
  issuerDisplay?: MetadataDisplay

  credentialsSupported: CredentialSupported[]
}

export interface CreateCredentialOfferAndRequestOptions {
  // The scheme used for the credentialIssuer. Default is https
  scheme?: 'http' | 'https' | 'openid-credential-offer' | string

  // The base URI of the credential offer uri
  baseUri?: string

  preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig

  credentialOfferUri?: string
}

export type CredentialOfferAndRequest = {
  credentialOfferPayload: CredentialOfferPayloadV1_0_11
  credentialOfferRequest: string
}

export interface CreateIssueCredentialResponseOptions {
  credentialRequest: CredentialRequestV1_0_11
  credential: W3cCredential | SdJwtCredential
  verificationMethod: VerificationMethod
}

export { CredentialRequestV1_0_11 }

export { CredentialResponse } from '@sphereon/oid4vci-common'

export interface MetadataEndpointConfig {
  /**
   * Configures the router to expose the metadata endpoint.
   */
  enabled: boolean
}

export interface AccessTokenEndpointConfig {
  /**
   * Configures the router to expose the access token endpoint.
   */
  enabled: boolean

  /**
   * The minimum amount of time in seconds that the client SHOULD wait between polling requests to the Token Endpoint in the Pre-Authorized Code Flow.
   * If no value is provided, clients MUST use 5 as the default.
   */
  interval?: number

  /**
   * The verification method to be used to sign access token.
   */
  verificationMethod: VerificationMethod

  /**
   * The maximum amount of time in seconds that the pre-authorized code is valid.
   */
  preAuthorizedCodeExpirationDuration: number
}

export type CredentialRequestToCredentialMapper = (options: {
  agentContext: AgentContext
  credentialRequest: CredentialRequestV1_0_11
  holderDid: string
  holderDidUrl: string
  cNonceState: CNonceState
  credentialOfferSession: CredentialOfferSession
}) => Promise<W3cCredential | SdJwtCredential>

export interface CredentialEndpointConfig {
  /**
   * Configures the router to expose the credential endpoint.
   */
  enabled: boolean

  /**
   * The verification method to be used to sign the credential.
   */
  verificationMethod: VerificationMethod

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  credentialRequestToCredentialMapper: CredentialRequestToCredentialMapper
}

export interface IssuerEndpointConfig {
  basePath: string
  metadataEndpointConfig?: MetadataEndpointConfig
  accessTokenEndpointConfig?: AccessTokenEndpointConfig
  credentialEndpointConfig?: CredentialEndpointConfig
}
