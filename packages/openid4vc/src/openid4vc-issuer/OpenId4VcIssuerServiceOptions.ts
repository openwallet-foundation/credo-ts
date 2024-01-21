import type { OpenId4VcIssuerRecordProps } from './repository'
import type {
  CredentialHolderBinding,
  OpenId4VciCredentialOffer,
  OpenId4VciCredentialOfferPayload,
  OpenId4VciCredentialRequest,
  OpenId4VciCredentialSupported,
  OpenId4VciIssuerMetadataDisplay,
} from '../shared'
import type { AgentContext, W3cCredential } from '@aries-framework/core'
import type { SdJwtVcSignOptions } from '@aries-framework/sd-jwt-vc'

export interface OpenId4VciPreAuthorizedCodeFlowConfig {
  preAuthorizedCode?: string
  userPinRequired?: boolean
}

export type OpenId4VciAuthorizationCodeFlowConfig = {
  issuerState?: string
}

export type OpenId4VcIssuerMetadata = {
  // The Credential Issuer's identifier. (URL using the https scheme)
  issuerUrl: string
  credentialEndpoint: string
  tokenEndpoint: string
  authorizationServer?: string

  issuerDisplay?: OpenId4VciIssuerMetadataDisplay[]
  credentialsSupported: OpenId4VciCredentialSupported[]
}

export type OpenId4VciCreateIssuerOptions = Pick<OpenId4VcIssuerRecordProps, 'credentialsSupported' | 'display'>

export interface OpenId4VciCreateCredentialOfferOptions {
  // NOTE: v11 of OID4VCI supports both inline and referenced (to credentials_supported.id) credential offers.
  // In draft 12 the inline credential offers have been removed and to make the migration to v12 easier
  // we only support referenced credentials in an offer
  offeredCredentials: string[]

  // FIXME: can we simplify this?
  // The scheme used for the credentialIssuer. Default is https
  scheme?: 'http' | 'https' | 'openid-credential-offer' | string

  // The base URI of the credential offer uri
  baseUri?: string

  preAuthorizedCodeFlowConfig?: OpenId4VciPreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: OpenId4VciAuthorizationCodeFlowConfig

  credentialOfferUri?: string
}

// FIXME: this needs to be renamed, but will class with OpenId4VciCredentialOffer
// Probably needs to be specific `XXReturn` type
export type CredentialOffer = {
  credentialOfferPayload: OpenId4VciCredentialOfferPayload
  credentialOfferUri: string
}

// FIXME: openid4vc prefix for all interfaces
export interface CreateCredentialResponseOptions {
  credentialRequest: OpenId4VciCredentialRequest

  /**
   * You can optionally provide a credential request to credential mapper that will be
   * dynamically invoked to return credential data based on the credential request.
   *
   * If not provided, the `credentialRequestToCredentialMapper` from the agent config
   * will be used.
   */
  credentialRequestToCredentialMapper?: OpenId4VciCredentialRequestToCredentialMapper
}

// FIXME: openid4vc prefix for all interfaces
// FIXME: Flows:
// - provide credential data at time of offer creation
// - provide credential data dynamically using this method
export type OpenId4VciCredentialRequestToCredentialMapper = (options: {
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
}) => Promise<OpenId4VciSignCredential> | OpenId4VciSignCredential

// FIXME: can we make these interfaces more uniform or is it okay
// to have quite some differences between them? I think the nice
// thing here is that they are based on the interface from the
// w3c and sd-jwt services. However in that case you could also
// ask why not just require the signed credential as output
// as you can then just call the services yourself.
// FIMXE: add type for type of credential. Also to input of mapper. W3c can be returned for jwt + ldp. and sd-jwt for vc+sd-jwt
export type OpenId4VciSignCredential = OpenId4VciSignSdJwtCredential | OpenId4VciSignW3cCredential
export type OpenId4VciSignSdJwtCredential = SdJwtVcSignOptions
export interface OpenId4VciSignW3cCredential {
  verificationMethod: string
  credential: W3cCredential
}
