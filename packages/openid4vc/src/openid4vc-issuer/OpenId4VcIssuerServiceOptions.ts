import type {
  AgentContext,
  ClaimFormat,
  JwaSignatureAlgorithm,
  KeyType,
  MdocSignOptions,
  SdJwtVcSignOptions,
  W3cCredential,
} from '@credo-ts/core'
import type { AccessTokenProfileJwtPayload, TokenIntrospectionResponse } from '@openid4vc/oauth2'
import type {
  OpenId4VcVerificationSessionRecord,
  OpenId4VpCreateAuthorizationRequestReturn,
  OpenId4VpVerifiedAuthorizationResponseDcql,
  OpenId4VpVerifiedAuthorizationResponsePresentationExchange,
} from '../openid4vc-verifier'
import type {
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
  OpenId4VciCredentialOfferPayload,
  OpenId4VciCredentialRequest,
  OpenId4VciCredentialRequestFormatSpecific,
  OpenId4VciTxCode,
  VerifiedOpenId4VcCredentialHolderBinding,
} from '../shared'
import type { OpenId4VciAuthorizationServerConfig } from '../shared/models/OpenId4VciAuthorizationServerConfig'
import { OpenId4VcIssuanceSessionRecord, OpenId4VcIssuerRecordProps } from './repository'

export interface OpenId4VciCredentialRequestAuthorization {
  authorizationServer: string
  accessToken: {
    payload: AccessTokenProfileJwtPayload | TokenIntrospectionResponse
    value: string
  }
}

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
  /**
   * OPTIONAL. String value created by the Credential Issuer and opaque to the Wallet
   * that is used to bind the subsequent Authorization Request with the Credential Issuer
   * to a context set up during previous steps.
   * If not provided, a value will be generated.
   */
  issuerState?: string

  /**
   * OPTIONAL string that the Wallet can use to identify the Authorization Server to use with this grant
   * type when authorization_servers parameter in the Credential Issuer metadata has multiple entries.
   */
  authorizationServerUrl?: string

  /**
   * Whether presentation using OpenID4VP is required as part of the authorization flow. The presentation
   * request will be created dynamically when the wallet initiates the authorization flow using the
   * `getVerificationSessionForIssuanceSessionAuthorization` callback in the issuer module config.
   *
   * You can dynamically create the verification session based on the provided issuace session, or you
   * can have a more generic implementation based on credential configurations and scopes that are being
   * requested.
   *
   * In case this parameter is set to true, `authorizationServerUrl` MUST be undefined or match the
   * `credential_issuer` value, as only Credo can handle this flow.
   *
   * In case this parameter is set to true, and `getVerificationSessionForIssuanceSessionAuthorization` is
   * not configured on the issuer module an error will be thrown.
   *
   * @default false
   */
  requirePresentationDuringIssuance?: boolean
}

interface OpenId4VciCreateCredentialOfferOptionsBase {
  /**
   * The credential configurations to offer.
   *
   * At least one id must be offered, and all ids must be present in the credential configurations.
   */
  credentialConfigurationIds: string[]

  /**
   * baseUri for the credential offer uri. By default `openid-credential-offer://` will be used
   * if no value is provided. If a value is provided, make sure it contains the scheme as well as `://`.
   */
  baseUri?: string

  /**
   * @default v1.draft11-15
   *
   * NOTE: `v1.draft15` credential is compatible with draft 13 credential offer as well. Only the issuer metadata
   * is different, so ensure you configure the issuer metadata in a compatible way based on the provided draft version.
   */
  version?: 'v1.draft11-15' | 'v1.draft15'
}

export interface OpenId4VciCreateStatelessCredentialOfferOptions extends OpenId4VciCreateCredentialOfferOptionsBase {
  authorizationCodeFlowConfig: Required<Pick<OpenId4VciAuthorizationCodeFlowConfig, 'authorizationServerUrl'>>

  /**
   * For stateless credential offers we need an external authorization server, which also means we need to
   * support `authorization_servers`.
   *
   * NOTE: `v1.draft15` credential is compatible with draft 13 credential offer as well. Only the issuer metadata
   * is different, so ensure you configure the issuer metadata in a compatible way based on the provided draft version.
   *
   * @default v1.draft15
   */
  version?: 'v1.draft15'
}

export interface OpenId4VciCreateCredentialOfferOptions extends OpenId4VciCreateCredentialOfferOptionsBase {
  preAuthorizedCodeFlowConfig?: OpenId4VciPreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: OpenId4VciAuthorizationCodeFlowConfig

  /**
   * Options related to authorization, for both the pre-authorized and authorizat_code flows.
   */
  authorization?: {
    /**
     * Whether wallet attestations are required at the PAR, Authorization Challenge and token endpoints.
     *
     * If not provided, the value from the global agent config will be used.
     *
     * NOTE: this only has effect if the Credo authorization server is used. If an external authorization
     * server is used, it's up to the authorization server to require wallet attestations for client authentication.
     */
    requireWalletAttestation: boolean

    /**
     * Whether DPoP is required.
     *
     * If not provided, the value from the global agent config will be used.
     *
     * NOTE: it's up to the authorization server to enforce DPoP binding. So if an external authorization server
     * is used, and DPoP is required, you should ensure the authorization server enforces DPoP. If DPoP is required
     * but not bound to the access token created by an external authorization server, the issuance will fail when the
     * credential endpoint is called.
     */
    requireDpop: boolean
  }

  /**
   * Metadata about the issuance, that will be stored in the issuance session record and
   * passed to the credential request to credential mapper. This can be used to e.g. store an
   * user identifier so user data can be fetched in the credential mapper, or the actual credential
   * data.
   */
  issuanceMetadata?: Record<string, unknown>
}

export interface OpenId4VciCreateCredentialResponseOptions {
  credentialRequest: OpenId4VciCredentialRequest
  authorization: OpenId4VciCredentialRequestAuthorization

  /**
   * You can optionally provide a credential request to credential mapper that will be
   * dynamically invoked to return credential data based on the credential request.
   *
   * If not provided, the `credentialRequestToCredentialMapper` from the agent config
   * will be used.
   */
  credentialRequestToCredentialMapper?: OpenId4VciCredentialRequestToCredentialMapper
}

/**
 * Callback that is called when a verification session needs to be created to complete
 * authorization of credential issuance.
 *
 *
 */
export type OpenId4VciGetVerificationSessionForIssuanceSessionAuthorization = (options: {
  agentContext: AgentContext
  issuanceSession: OpenId4VcIssuanceSessionRecord

  /**
   * The credential configurations for which authorization has been requested based on the **scope**
   * values. It doesn't mean the wallet will request all credentials to be issued.
   */
  requestedCredentialConfigurations: OpenId4VciCredentialConfigurationsSupportedWithFormats

  /**
   * The scopes which were requested and are also present in the credential configurations supported
   * that were offered. It will match with the scope values in the `requestedCredentialConfiguration`
   * parameter
   */
  scopes: string[]
}) => Promise<
  OpenId4VpCreateAuthorizationRequestReturn & {
    /**
     * The scopes which will be granted by successfully completing the verification
     * session.
     *
     * @todo do we need more granular support? I.e. every input descriptor can satisfy a
     * different scope?
     */
    scopes: string[]
  }
>

export interface OpenId4VciCredentialRequestToCredentialMapperOptions {
  agentContext: AgentContext

  /**
   * Authorization associated with the credential request
   */
  authorization: OpenId4VciCredentialRequestAuthorization

  /**
   * If an openid4vp verification was done as part of the authorization flow this parameter will be defined.
   *
   * The contents can be used to populate credential data
   */
  verification?: {
    session: OpenId4VcVerificationSessionRecord
  } & (
    | {
        presentationExchange: OpenId4VpVerifiedAuthorizationResponsePresentationExchange
        dcql?: never
      }
    | {
        dcql: OpenId4VpVerifiedAuthorizationResponseDcql
        presentationExchange?: never
      }
  )

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
   * Contains format specific credential request data. This will only be
   * defined if a credential was requested using the `format` syntax
   */
  credentialRequestFormat?: OpenId4VciCredentialRequestFormatSpecific

  /**
   * The offer associated with the credential request
   */
  credentialOffer: OpenId4VciCredentialOfferPayload

  /**
   * Verified key binding material entries that should be included in the credential(s)
   * A separate credential should be returned for each holder binding entry.
   *
   * All keys and dids have a verified proof, or in the case a key attestation is provided
   * are attested by a key attestation. Ensure the issuer of the key attestation is trusted.
   */
  holderBinding: VerifiedOpenId4VcCredentialHolderBinding

  /**
   * The credential configurations supported entry from the issuer metadata
   * that was offered and matches the incoming request.
   *
   * If multiple offered configuration match the request (which is possible pre-draft 15)
   * the first configuration that has not been issued yet will be passed.
   */
  credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats

  /**
   * The ids of the credential configuration that was offered and matches the request.
   */
  credentialConfigurationId: string
}
export type OpenId4VciCredentialRequestToCredentialMapper = (
  options: OpenId4VciCredentialRequestToCredentialMapperOptions
) => Promise<OpenId4VciSignCredentials> | OpenId4VciSignCredentials

export type OpenId4VciSignCredentials =
  | OpenId4VciSignSdJwtCredentials
  | OpenId4VciSignW3cCredentials
  | OpenId4VciSignMdocCredentials

export interface OpenId4VciSignSdJwtCredentials {
  format: ClaimFormat.SdJwtVc | `${ClaimFormat.SdJwtVc}`
  credentials: SdJwtVcSignOptions[]
}

export interface OpenId4VciSignMdocCredentials {
  format: ClaimFormat.MsoMdoc | `${ClaimFormat.MsoMdoc}`
  credentials: MdocSignOptions[]
}

export interface OpenId4VciSignW3cCredentials {
  format: ClaimFormat.JwtVc | `${ClaimFormat.JwtVc}` | ClaimFormat.LdpVc | `${ClaimFormat.LdpVc}`
  credentials: Array<{
    verificationMethod: string
    credential: W3cCredential
  }>
}

export interface OpenId4VciBatchCredentialIssuanceOptions {
  /**
   * The maximum batch size
   */
  batchSize: number
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

  /**
   * Indicate support for batch issuane of credentials
   */
  batchCredentialIssuance?: OpenId4VciBatchCredentialIssuanceOptions
}

export type OpenId4VcUpdateIssuerRecordOptions = Pick<
  OpenId4VcIssuerRecordProps,
  | 'issuerId'
  | 'display'
  | 'dpopSigningAlgValuesSupported'
  | 'credentialConfigurationsSupported'
  | 'batchCredentialIssuance'
>
