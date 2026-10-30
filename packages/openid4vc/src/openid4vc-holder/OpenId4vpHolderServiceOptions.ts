import type {
  DcqlCredentialsForRequest,
  DcqlQueryResult,
  DifPexCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  EncodedX509Certificate,
} from '@credo-ts/core'
import type { Openid4vpAuthorizationRequestError, ResolvedOpenid4vpAuthorizationRequest } from '@openid4vc/openid4vp'
import type { OpenId4VpAuthorizationRequestPayload } from '../shared'

// TODO: export from oid4vp
export type ParsedTransactionDataEntry = NonNullable<ResolvedOpenid4vpAuthorizationRequest['transactionData']>[number]

export interface ResolveOpenId4VpAuthorizationRequestOptions {
  trustedCertificates?: EncodedX509Certificate[]
  origin?: string
}

type VerifiedJarRequest = NonNullable<ResolvedOpenid4vpAuthorizationRequest['jar']>

export interface OpenId4VpResolvedAuthorizationRequest {
  /**
   * Parameters related to DIF Presentation Exchange. Only defined when
   * the request included a presentation definition.
   */
  presentationExchange?: {
    definition: DifPresentationExchangeDefinition
    credentialsForRequest: DifPexCredentialsForRequest
  }

  /**
   * Parameters related to DCQL. Only defined when
   * the request included a dcql query.
   */
  dcql?: {
    queryResult: DcqlQueryResult
  }

  /**
   * The transaction data entries, with the matched credential ids.
   * - For Presentation Exchange the id refers to the presentation exchange id
   * - For DCQL the id refers to the credential query id
   *
   * If no matches were found the `matchedCredentialIds` will be empty and means
   * the presetnation cannot be satisfied.
   *
   * The entries have the same order as the transaction data entries from the request
   */
  transactionData?: Array<{
    entry: ParsedTransactionDataEntry
    matchedCredentialIds: string[]
  }>

  /**
   * The authorization request payload
   */
  authorizationRequestPayload: OpenId4VpAuthorizationRequestPayload

  /**
   * Metadata about the signed authorization request.
   *
   * Only present if the authorization request was signed
   */
  signedAuthorizationRequest?: {
    signer: VerifiedJarRequest['signer']
    payload: VerifiedJarRequest['jwt']['payload']
    header: VerifiedJarRequest['jwt']['header']
    compact: VerifiedJarRequest['jwt']['compact']
  }

  verifier: {
    /**
     * The client id prefix in normalized form (so e.g. 'did' is returned as 'decentralized_identifier')
     */
    clientIdPrefix: ResolvedOpenid4vpAuthorizationRequest['client']['prefix']

    /**
     * The effective client id, taking into account default values and different draft versions.
     */
    effectiveClientId: ResolvedOpenid4vpAuthorizationRequest['client']['effective']

    /**
     * The client id metadata.
     *
     * In case of 'openid_federation' client id prefix, this will be the metadata from the federation.
     * clientMetadata?: ClientMetadata
     */
  }

  /**
   * Origin of the request, to be used with Digital Credentials API
   */
  origin?: string
}

export interface OpenId4VpAcceptAuthorizationRequestOptions {
  /**
   * Parameters related to DIF Presentation Exchange. MUST be present when the resolved
   * authorization request included a `presentationExchange` parameter.
   */
  presentationExchange?: {
    credentials: DifPexInputDescriptorToCredentials
  }

  /**
   * Parameters related to Dcql. MUST be present when the resolved
   * authorization request included a `dcql` parameter.
   */
  dcql?: {
    credentials: DcqlCredentialsForRequest
  }

  /**
   * The credentials to use for the transaction data hashes in the presentation. The length
   * of the array MUST be the same length as the transaction data entries in the authorization
   * request, and follow the same order (meaning the first entry in this array matches the first
   * entry in the transaction data from the request).
   *
   * - For Presentation Exchange the id refers to the presentation exchange id
   * - For DCQL the id refers to the credential query id
   *
   */
  transactionData?: Array<{
    credentialId: string
  }>

  /**
   * The authorization request payload
   */
  authorizationRequestPayload: OpenId4VpAuthorizationRequestPayload

  /**
   * The origin of the verifier that is making the request.
   * Required in combination with the DC Api
   */
  origin?: string
}

/**
 * The error codes a wallet can return in an OpenID4VP Authorization Error Response ([OpenID4VP 1.0] Section 8.5).
 */
export type OpenId4VpAuthorizationErrorCode =
  | 'access_denied'
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_scope'
  | 'vp_formats_not_supported'
  | 'invalid_request_uri_method'
  | 'invalid_transaction_data'
  | 'wallet_unavailable'

export type OpenId4VpDeclineAuthorizationRequestOptions =
  | {
      /**
       * The payload of the resolved authorization request.
       */
      authorizationRequestPayload: OpenId4VpAuthorizationRequestPayload

      /**
       * The origin of the verifier that is making the request.
       * Required in combination with the DC Api
       */
      origin?: string

      /**
       * The error to return. `access_denied` covers both a user that declines and a wallet that doesn't
       * have the requested credentials, so the verifier can't tell those apart.
       *
       * @default 'access_denied'
       */
      error?: OpenId4VpAuthorizationErrorCode

      /**
       * Leave out anything that tells the verifier about the user or their credentials ([OpenID4VP 1.0] Section 15.9).
       * Not included in a DC API response.
       */
      errorDescription?: string
    }
  | {
      /**
       * The error thrown when resolving the authorization request. Its `errorResponse` is sent to the
       * `response_uri` of the request. When the client is not authenticated (`isClientAuthenticated`), the
       * `redirectUri` the verifier returns is left out of the result.
       */
      authorizationRequestError: Openid4vpAuthorizationRequestError

      /**
       * The origin of the verifier that is making the request.
       * Required in combination with the DC Api
       */
      origin?: string
    }
