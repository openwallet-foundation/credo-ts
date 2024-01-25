import type { OpenId4VcIssuerRecordProps } from './repository'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VciCredentialOffer,
  OpenId4VciCredentialRequest,
  OpenId4VciCredentialSupported,
  OpenId4VciIssuerMetadataDisplay,
} from '../shared'
import type { AgentContext, ClaimFormat, W3cCredential, SdJwtVcSignOptions } from '@aries-framework/core'

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

  /**
   * baseUri for the credential offer uri. By default `openid-credential-offer://` will be used
   * if no value is provided. If a value is provided, make sure it contains the scheme as well as `://`.
   */
  baseUri?: string

  preAuthorizedCodeFlowConfig?: OpenId4VciPreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: OpenId4VciAuthorizationCodeFlowConfig

  /**
   * You can provide a `hostedCredentialOfferUrl` if the created credential offer
   * should points to a hosted credential offer in the `credential_offer_uri` field
   * of the credential offer.
   */
  hostedCredentialOfferUrl?: string
}

export interface OpenId4VciCreateCredentialResponseOptions {
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

// FIXME: Flows:
// - provide credential data at time of offer creation (NOT SUPPORTED)
// - provide credential data at time of calling createCredentialResponse (partially supported by passing in mapper to this method -> preferred as it gives you request data dynamically)
// - provide credential data dynamically using this method (SUPPORTED)
// mapper should get input data passed (which is supplied to offer or create response) like credentialDataSupplierInput in sphereon lib
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
  holderBinding: OpenId4VcCredentialHolderBinding

  /**
   * The credentials supported entries from the issuer metadata that were offered
   * and match the incoming request
   *
   * NOTE: in v12 this will probably become a single entry, as it will be matched on id
   */
  credentialsSupported: OpenId4VciCredentialSupported[]
}) => Promise<OpenId4VciSignCredential> | OpenId4VciSignCredential

export type OpenId4VciSignCredential = OpenId4VciSignSdJwtCredential | OpenId4VciSignW3cCredential
export interface OpenId4VciSignSdJwtCredential extends SdJwtVcSignOptions {
  format: ClaimFormat.SdJwtVc | `${ClaimFormat.SdJwtVc}`
}

export interface OpenId4VciSignW3cCredential {
  format: ClaimFormat.JwtVc | `${ClaimFormat.JwtVc}` | ClaimFormat.LdpVc | `${ClaimFormat.LdpVc}`
  verificationMethod: string
  credential: W3cCredential
}
