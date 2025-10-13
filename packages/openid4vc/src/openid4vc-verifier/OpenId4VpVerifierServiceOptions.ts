import type {
  DcqlPresentation,
  DcqlPresentationResult,
  DcqlQuery,
  DifPexPresentationWithDescriptor,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmission,
  HashName,
  VerifiablePresentation,
} from '@credo-ts/core'
import type {
  TransactionDataEntry,
  VerifierAttestations,
  createOpenid4vpAuthorizationRequest,
} from '@openid4vc/openid4vp'
import type { NonEmptyArray } from '@openid4vc/utils'
import type { OpenId4VcIssuerX5c, OpenId4VcJwtIssuerDid, OpenId4VcJwtIssuerFederation } from '../shared'
import type { OpenId4VcVerificationSessionRecord, OpenId4VcVerifierRecordProps } from './repository'

export type ResponseMode = 'direct_post' | 'direct_post.jwt' | 'dc_api' | 'dc_api.jwt'

export interface OpenId4VpCreateAuthorizationRequestOptions {
  /**
   * Signing information for the request JWT. This will be used to sign the request JWT
   * and to set the client_id for registration of client_metadata.
   */
  requestSigner:
    | OpenId4VcJwtIssuerDid
    | Omit<OpenId4VcIssuerX5c, 'issuer'>
    | Omit<OpenId4VcJwtIssuerFederation, 'entityId'>
    | {
        /**
         * Do not sign the request, will use `redirect_uri` client id prefix
         */
        method: 'none'
      }

  /**
   * Transaction data entries that need to be hashes and signed over by a specific credential
   */
  transactionData?: TransactionDataEntry[]

  /**
   *
   * Verifier Attestations allow the Verifier to provide additional context or metadata as part of the
   * Authorization Request attested by a trusted third party. These inputs can support a variety of use cases,
   * such as helping the Wallet apply policy decisions, validating eligibility, or presenting more meaningful
   * information to the End-User during consent.
   */
  verifierInfo?: VerifierAttestations

  /**
   * A DIF Presentation Definition (v2) can be provided to request a Verifiable Presentation using OpenID4VP.
   *
   * NOTE: when using version `v1` it is not allowed to use presentation exchange.
   */
  presentationExchange?: {
    definition: DifPresentationExchangeDefinitionV2
  }

  /**
   * A Digital Credentials Query Language (DCQL) can be provided to request the presentation of a Verifiable Credentials.
   */
  dcql?: {
    query: DcqlQuery
  }

  /**
   * The response mode to use for the authorization request.
   * @default to `direct_post.jwt`.
   *
   * With response_mode `direct_post` the response will be posted directly to the `response_uri` provided in the request.
   * With response_mode `direct_post.jwt` the response will be encrypted and then posted to the `response_uri` provided in the request.
   * The response mode `dc_api` and `dc_api.jwt` should only be used if the request will be passed over the W3C Digital Credentials API. In this case
   *    the response must be manually submitted when a response is received using `verifyAuthorizationResponse`.
   *
   */
  responseMode?: ResponseMode

  /**
   * Redirect uri that should be used in the authorization response. This will be included in both error and success
   * responses. It can prevent session fixation, and allows to continue the flow in the browser after redirect.
   *
   * For same-device flows it allows continuing the flow. Based on the redirect uri, you can retrieve the session
   * and display error or success screens.
   *
   * NOTE: the Uri MUST include randomness so the URL cannot be guessed, recommended is to have at least 128 bits of
   * randomness, which is unique for each request.
   */
  authorizationResponseRedirectUri?: string

  /**
   * The expected origins of the authorization response.
   * REQUIRED when signed requests defined in Appendix A.3.2 are used with the Digital Credentials API (DC API). An array of strings, each string representing an Origin of the Verifier that is making the request.
   */
  expectedOrigins?: string[]

  /**
   * The draft version of OpenID4VP to use for the authorization request.
   *
   * It is recommended to use `v1`, as previous drafts will be deprecated and
   * removed in future versions.
   *
   * - For alignment with ISO 18013-7 (remote mDOC) `v1.draft21` should be used.
   * - When responseMode is `dc_api` or `dc_api.jwt` version `v1.draft21` is not supported.
   * - When `verifierInfo` is provided, version `v1.draft21` and 'v1.draft24' are not supported.
   *
   * @default `v1`
   */
  version?: OpenId4VpVersion
}

export type OpenId4VpVersion = 'v1' | 'v1.draft21' | 'v1.draft24'

export interface OpenId4VpVerifyAuthorizationResponseOptions {
  /**
   * The authorization response received from the OpenID Provider (OP).
   */
  authorizationResponse: Record<string, unknown>

  /**
   * The origin of the verification session, if Digital Credentials API was used.
   */
  origin?: string
}

export interface OpenId4VpCreateAuthorizationRequestReturn {
  authorizationRequest: string
  verificationSession: OpenId4VcVerificationSessionRecord
  // TODO: type needs to be exported. It can also be a JAR object, so we use
  // return value for now
  authorizationRequestObject: Awaited<
    ReturnType<typeof createOpenid4vpAuthorizationRequest>
  >['authorizationRequestObject']
}

export interface OpenId4VpVerifiedAuthorizationResponsePresentationExchange {
  submission: DifPresentationExchangeSubmission
  definition: DifPresentationExchangeDefinition
  // TODO: we can also make this an object, where the keys are the input descriptors?
  // Might not work as well with PEX. Or at least the object apporach is moslty focused on
  // 1 credential 1 presentation
  presentations: Array<VerifiablePresentation>
  descriptors: DifPexPresentationWithDescriptor[]
}

export interface OpenId4VpVerifiedAuthorizationResponseTransactionData {
  /**
   * The index of the transaction data entry in the openid4vp authorization request
   */
  transactionDataIndex: number

  /**
   * The base64url encoded transaction data
   */
  encoded: string

  /**
   * The decoded transaction data entry
   */
  decoded: TransactionDataEntry

  /**
   * The credential id to which the hash applies.
   * - Matches with an input descriptor id for PEX
   * - Matches with a credential query id for DCQL
   */
  credentialId: string

  /**
   * The transaction data results for the presentations that were submitted in the authorization response.
   * The order matches the order of the submitted presentations. If one of the presentations for a query id
   * included a transaction data hash, all presentations must include the transaction data hash (in case 'multiple'
   * feture of DCQL is used).
   */
  presentations: NonEmptyArray<{
    /**
     * The hash of the transaction data
     */
    hash: string

    /**
     * The hash algorithm that was used to hash the transaction data
     */
    hashAlg: HashName

    /**
     * The index of the hash within the presentation.
     */
    presentationHashIndex: number
  }>
}

export interface OpenId4VpVerifiedAuthorizationResponseDcql {
  query: DcqlQuery
  presentations: DcqlPresentation
  presentationResult: DcqlPresentationResult
}

export interface OpenId4VpVerifiedAuthorizationResponse {
  presentationExchange?: OpenId4VpVerifiedAuthorizationResponsePresentationExchange
  dcql?: OpenId4VpVerifiedAuthorizationResponseDcql

  /**
   * The verified transaction data entries from the request
   */
  transactionData?: OpenId4VpVerifiedAuthorizationResponseTransactionData[]

  /**
   * The verification session associated with the response
   */
  verificationSession: OpenId4VcVerificationSessionRecord
}

/**
 * Verifier metadata that will be send when creating a request
 */
export interface OpenId4VpVerifierClientMetadata {
  client_name?: string
  logo_uri?: string
}

export interface OpenId4VpCreateVerifierOptions {
  /**
   * Id of the verifier, not the id of the verifier record. Will be exposed publicly
   */
  verifierId?: string

  /**
   * Optional client metadata that will be included in requests
   */
  clientMetadata?: OpenId4VpVerifierClientMetadata
}

export type OpenId4VcUpdateVerifierRecordOptions = Pick<OpenId4VcVerifierRecordProps, 'verifierId' | 'clientMetadata'>
