import type { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuerRecordProps } from './repository'
import type {
  OpenId4VcCredentialHolderBindingWithKey,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialOfferPayload,
  OpenId4VciCredentialRequest,
  OpenId4VciCredentialRequestFormatSpecific,
  OpenId4VciCredentialIssuerMetadataDisplay,
  OpenId4VciTxCode,
} from '../shared'
import type { OpenId4VciAuthorizationServerConfig } from '../shared/models/OpenId4VciAuthorizationServerConfig'
import type {
  AgentContext,
  ClaimFormat,
  W3cCredential,
  SdJwtVcSignOptions,
  JwaSignatureAlgorithm,
  MdocSignOptions,
  KeyType,
} from '@credo-ts/core'

export interface OpenId4VciPreAuthorizedCodeFlowConfig {
  preAuthorizedCode?: string

  /**
   * The user pin required flag indicates whether the user needs to enter a pin to authorize the transaction.
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
  credentialRequest: OpenId4VciCredentialRequest

  /**
   * Contains format specific credential request data. Currently it will
   * always be defined, but may be undefined once `credential_identifier`
   * in the credential request will be supported
   */
  credentialRequestFormat?: OpenId4VciCredentialRequestFormatSpecific

  /**
   * The offer associated with the credential request
   */
  credentialOffer: OpenId4VciCredentialOfferPayload

  /**
   * Verified key binding material entries that should be included in the credential(s)
   * A separate credential should be returned for each holder binding.
   *
   * Can either be bound to did or a JWK (in case of for ex. SD-JWT).
   */
  holderBindings: OpenId4VcCredentialHolderBindingWithKey[]

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
}) => Promise<OpenId4VciSignCredentials> | OpenId4VciSignCredentials

export type OpenId4VciSignCredentials =
  | OpenId4VciSignSdJwtCredentials
  | OpenId4VciSignW3cCredentials
  | OpenId4VciSignMdocCredentials

export interface OpenId4VciSignSdJwtCredentials {
  credentialConfigurationId: string
  format: ClaimFormat.SdJwtVc | `${ClaimFormat.SdJwtVc}`
  credentials: SdJwtVcSignOptions[]
}

export interface OpenId4VciSignMdocCredentials {
  credentialConfigurationId: string
  format: ClaimFormat.MsoMdoc | `${ClaimFormat.MsoMdoc}`
  credentials: MdocSignOptions[]
}

export interface OpenId4VciSignW3cCredentials {
  credentialConfigurationId: string
  format: ClaimFormat.JwtVc | `${ClaimFormat.JwtVc}` | ClaimFormat.LdpVc | `${ClaimFormat.LdpVc}`
  credentials: Array<{
    verificationMethod: string
    credential: W3cCredential
  }>
}

export type OpenId4VciCreateIssuerOptions = {
  /**
   * Id of the issuer, not the id of the issuer record. Will be exposed publicly
   */
  issuerId?: string

  /**
   * Key type to use for signing access tokens
   *
   * @default KeyType.Ed25519
   */
  accessTokenSignerKeyType?: KeyType

  display?: OpenId4VciCredentialIssuerMetadataDisplay[]
  authorizationServerConfigs?: OpenId4VciAuthorizationServerConfig[]
  dpopSigningAlgValuesSupported?: [JwaSignatureAlgorithm, ...JwaSignatureAlgorithm[]]
  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupportedWithFormats
}

export type OpenId4VcUpdateIssuerRecordOptions = Pick<
  OpenId4VcIssuerRecordProps,
  'issuerId' | 'display' | 'dpopSigningAlgValuesSupported' | 'credentialConfigurationsSupported'
>
