import type {
  OpenId4VcIssuanceSessionRecord,
  OpenId4VcIssuerRecordCredentialConfigurationsSupportedProps,
  OpenId4VcIssuerRecordCredentialSupportedProps,
  OpenId4VcIssuerRecordProps,
} from './repository'
import type {
  OpenId4VcCredentialHolderBinding,
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialOfferPayload,
  OpenId4VciCredentialRequest,
  OpenId4VciCredentialRequestWithFormats,
  OpenId4VciIssuerMetadataDisplay,
  OpenId4VciTxCode,
} from '../shared'
import type { OpenId4VciAuthorizationServerConfig } from '../shared/models/AuthorizationServer'
import type {
  AgentContext,
  ClaimFormat,
  W3cCredential,
  SdJwtVcSignOptions,
  JwaSignatureAlgorithm,
  MdocSignOptions,
  Key,
} from '@credo-ts/core'

export interface OpenId4VciPreAuthorizedCodeFlowConfig {
  preAuthorizedCode?: string

  /**
   * The user pin required flag indicates whether the user needs to enter a pin to authorize the transaction.
   * Only compatible with v11
   */
  userPinRequired?: boolean

  /**
   * The user pin required flag indicates whether the user needs to enter a pin to authorize the transaction.
   * Only compatible with v13
   */
  txCode?: OpenId4VciTxCode

  // OPTIONAL string that the Wallet can use to identify the Authorization Server to use with this grant
  // type when authorization_servers parameter in the Credential Issuer metadata has multiple entries.
  authorizationServerUrl?: string
}

export interface OpenId4VciAuthorizationCodeFlowConfig {
  // OPTIONAL. String value created by the Credential Issuer and opaque to the Wallet
  // that is used to bind the subsequent Authorization Request with the Credential Issuer
  // to a context set up during previous steps.
  // If not provided, a value will be generated.
  issuerState?: string

  // OPTIONAL string that the Wallet can use to identify the Authorization Server to use with this grant
  // type when authorization_servers parameter in the Credential Issuer metadata has multiple entries.
  authorizationServerUrl?: string
}

export type OpenId4VcIssuerMetadata = {
  // The Credential Issuer's identifier. (URL using the https scheme)
  issuerUrl: string
  credentialEndpoint: string
  tokenEndpoint: string
  authorizationServers?: string[]

  issuerDisplay?: OpenId4VciIssuerMetadataDisplay[]
  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupported
  dpopSigningAlgValuesSupported?: [JwaSignatureAlgorithm, ...JwaSignatureAlgorithm[]]
}

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
   * Metadata about the issuance, that will be stored in the issuance session record and
   * passed to the credential request to credential mapper. This can be used to e.g. store an
   * user identifier so user data can be fetched in the credential mapper, or the actual credential
   * data.
   */
  issuanceMetadata?: Record<string, unknown>

  /**
   * @default v1.draft11-13
   */
  version?: 'v1.draft11-13' | 'v1.draft13'
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
   * The issuance session associated with the credential request. You can extract the
   * issuance metadata from this record if passed in the offer creation method.
   */
  issuanceSession: OpenId4VcIssuanceSessionRecord

  /**
   * The credential request received from the wallet
   */
  credentialRequest: OpenId4VciCredentialRequestWithFormats

  /**
   * The offer associated with the credential request
   */
  credentialOffer: OpenId4VciCredentialOfferPayload

  /**
   * Verified key binding material that should be included in the credential
   *
   * Can either be bound to did or a JWK (in case of for ex. SD-JWT)
   */
  holderBinding: OpenId4VcCredentialHolderBinding & { key: Key }

  /**
   * The credential configurations supported entries from the issuer metadata
   * that were offered and match the incoming request.
   */
  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupportedWithFormats

  /**
   * v13: The ids of the credential configurations that were offered and match the request
   *
   * NOTE: This will probably become a single entry, as it will be matched on id
   */
  credentialConfigurationIds: [string, ...string[]]
}) => Promise<OpenId4VciSignCredential> | OpenId4VciSignCredential

export type OpenId4VciSignCredential =
  | OpenId4VciSignSdJwtCredential
  | OpenId4VciSignW3cCredential
  | OpenId4VciSignMdocCredential

export interface OpenId4VciSignSdJwtCredential extends SdJwtVcSignOptions {
  credentialSupportedId: string
  format: ClaimFormat.SdJwtVc | `${ClaimFormat.SdJwtVc}`
}

export interface OpenId4VciSignMdocCredential extends MdocSignOptions {
  credentialSupportedId: string
  format: ClaimFormat.MsoMdoc | `${ClaimFormat.MsoMdoc}`
}

export interface OpenId4VciSignW3cCredential {
  credentialSupportedId: string
  format: ClaimFormat.JwtVc | `${ClaimFormat.JwtVc}` | ClaimFormat.LdpVc | `${ClaimFormat.LdpVc}`
  verificationMethod: string
  credential: W3cCredential
}

export type OpenId4VciCreateIssuerOptions = {
  /**
   * Id of the issuer, not the id of the issuer record. Will be exposed publicly
   */
  issuerId?: string

  display?: OpenId4VciIssuerMetadataDisplay[]
  authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]
  dpopSigningAlgValuesSupported?: [JwaSignatureAlgorithm, ...JwaSignatureAlgorithm[]]
} & (OpenId4VcIssuerRecordCredentialSupportedProps | OpenId4VcIssuerRecordCredentialConfigurationsSupportedProps)

export type OpenId4VcUpdateIssuerRecordOptions = Pick<
  OpenId4VcIssuerRecordProps,
  'issuerId' | 'display' | 'dpopSigningAlgValuesSupported'
> &
  (OpenId4VcIssuerRecordCredentialSupportedProps | OpenId4VcIssuerRecordCredentialConfigurationsSupportedProps)
