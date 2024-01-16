import type { OpenId4VcIssuerRecordProps } from './repository/OpenId4VcIssuerRecord'
import type {
  CredentialHolderBinding,
  OpenId4VciCredentialOffer,
  OpenId4VciCredentialRequest,
  OpenId4VciCredentialSupported,
  OpenId4VciIssuerMetadataDisplay,
} from '../shared'
import type { AgentContext, W3cCredential } from '@aries-framework/core'
import type { SdJwtVcSignOptions } from '@aries-framework/sd-jwt-vc'
import type { CredentialOfferPayloadV1_0_11 } from '@sphereon/oid4vci-common'

export type PreAuthorizedCodeFlowConfig = {
  preAuthorizedCode?: string
  userPinRequired?: boolean
}

export type AuthorizationCodeFlowConfig = {
  issuerState?: string
}

export type IssuerMetadata = {
  // The Credential Issuer's identifier. (URL using the https scheme)
  issuerUrl: string
  credentialEndpoint: string
  tokenEndpoint: string
  authorizationServer?: string

  issuerDisplay?: OpenId4VciIssuerMetadataDisplay[]
  credentialsSupported: OpenId4VciCredentialSupported[]
}

export type CreateIssuerOptions = Pick<OpenId4VcIssuerRecordProps, 'credentialsSupported' | 'display'>

export interface CreateCredentialOfferOptions {
  // NOTE: v11 of OID4VCI supports both inline and referenced (to credentials_supported.id) credential offers.
  // In draft 12 the inline credential offers have been removed and to make the migration to v12 easier
  // we only support referenced credentials in an offer
  offeredCredentials: string[]

  // FIXME: can we simplify this?
  // The scheme used for the credentialIssuer. Default is https
  scheme?: 'http' | 'https' | 'openid-credential-offer' | string

  // The base URI of the credential offer uri
  baseUri?: string

  preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig

  credentialOfferUri?: string
}

// FIXME: this needs to be renamed, but will class with OpenId4VciCredentialOffer
// Probably needs to be specific `XXReturn` type
export type CredentialOffer = {
  credentialOfferPayload: CredentialOfferPayloadV1_0_11
  credentialOfferUri: string
}

export interface CreateCredentialResponseOptions {
  credentialRequest: OpenId4VciCredentialRequest

  /**
   * You can optionally provide the input data for signing the credential.
   * If not provided the `credentialRequestToCredentialMapper` from the module
   * config will be called with needed data to construct the credential
   * signing payload
   */
  // FIXME: credential.credential is not nice
  credential?: OpenId4VciSignCredential
}

export type MetadataEndpointConfig = {
  /**
   * Configures the router to expose the metadata endpoint.
   */
  enabled: true
}

export type AccessTokenEndpointConfig = {
  /**
   * The path at which the token endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /token
   */
  endpointPath: string

  // FIXME: rename, more specific
  /**
   * The minimum amount of time in seconds that the client SHOULD wait between polling requests to the Token Endpoint in the Pre-Authorized Code Flow.
   * If no value is provided, clients MUST use 5 as the default.
   */
  interval?: number

  /**
   * The maximum amount of time in seconds that the pre-authorized code is valid.
   * @default 360 (5 minutes) // FIXME: what should be the default value
   */
  preAuthorizedCodeExpirationInSeconds: number

  /**
   * The time after which the cNonce from the access token response will
   * expire.
   *
   * @default 360 (5 minutes) // FIXME: what should be the default value?
   */
  cNonceExpiresInSeconds: number

  /**
   * The time after which the token will expire.
   *
   * @default 360 (5 minutes) // FIXME: what should be the default value?
   */
  tokenExpiresInSeconds: number
}

export type CredentialEndpointConfig = {
  /**
   * The path at which the credential endpoint should be made available. Note that it will be
   * hosted at a subpath to take into account multiple tenants and issuers.
   *
   * @default /credential
   */
  endpointPath: string

  /**
   * A function mapping a credential request to the credential to be issued.
   */
  credentialRequestToCredentialMapper: CredentialRequestToCredentialMapper
}

// FIXME: Flows:
// - provide credential data at time of offer creation
// - provide credential data dynamically using this method
export type CredentialRequestToCredentialMapper = (options: {
  agentContext: AgentContext

  /**
   * The credential request received from the wallet
   */
  credentialRequest: OpenId4VciCredentialRequest

  /**
   * The offer associated with the credential request
   */
  credentialOffer: OpenId4VciCredentialOffer

  /**
   * Verified key binding material that should be included in the credential
   *
   * Can either be bound to did or a JWK (in case of for ex. SD-JWT)
   */
  holderBinding: CredentialHolderBinding

  /**
   * The credentials supported entries from the issuer metadata that were offered
   * and match the incoming request
   *
   * NOTE: in v12 this will probably become a single entry, as it will be matched on id
   */
  credentialsSupported: OpenId4VciCredentialSupported[]
}) => Promise<OpenId4VciSignCredential>

// FIXME: can we make these interfaces more uniform or is it okay
// to have quite some differences between them? I think the nice
// thing here is that they are based on the interface from the
// w3c and sd-jwt services. However in that case you could also
// ask why not just require the signed credential as output
// as you can then just call the services yourself.
export type OpenId4VciSignCredential = OpenId4VciSignSdJwtCredential | OpenId4VciSignW3cCredential
export type OpenId4VciSignSdJwtCredential = SdJwtVcSignOptions
export interface OpenId4VciSignW3cCredential {
  verificationMethod: string
  credential: W3cCredential
}
