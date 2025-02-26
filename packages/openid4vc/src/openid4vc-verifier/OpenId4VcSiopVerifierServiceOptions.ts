import type { OpenId4VcVerificationSessionRecord, OpenId4VcVerifierRecordProps } from './repository'
import type { OpenId4VcIssuerX5c, OpenId4VcJwtIssuerDid, OpenId4VcSiopAuthorizationResponsePayload } from '../shared'
import type {
  DcqlPresentation,
  DcqlPresentationResult,
  DcqlQuery,
  DifPexPresentationWithDescriptor,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeDefinitionV2,
  DifPresentationExchangeSubmission,
  TransactionData,
  VerifiablePresentation,
} from '@credo-ts/core'
import type { createOpenid4vpAuthorizationRequest } from '@openid4vc/openid4vp'

export type ResponseMode = 'direct_post' | 'direct_post.jwt' | 'dc_api' | 'dc_api.jwt'

export interface OpenId4VcSiopCreateAuthorizationRequestOptions {
  /**
   * Signing information for the request JWT. This will be used to sign the request JWT
   * and to set the client_id and client_id_scheme for registration of client_metadata.
   */
  requestSigner:
    | OpenId4VcJwtIssuerDid
    | Omit<OpenId4VcIssuerX5c, 'issuer'>
    | {
        /**
         * Do not sign the request. Only available for DC API
         */
        method: 'none'
      }

  transactionData?: TransactionData

  /**
   * A DIF Presentation Definition (v2) can be provided to request a Verifiable Presentation using OpenID4VP.
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
   * @default to `direct_post`.
   *
   * With response_mode `direct_post` the response will be posted directly to the `response_uri` provided in the request.
   * With response_mode `direct_post.jwt` the response will be `signed` `encrypted` or `signed and encrypted` and then posted to the `response_uri` provided in the request.
   */
  responseMode?: ResponseMode

  /**
   * The expected origins of the authorization response.
   * REQUIRED when signed requests defined in Appendix A.3.2 are used with the Digital Credentials API (DC API). An array of strings, each string representing an Origin of the Verifier that is making the request.
   */
  expectedOrigins?: string[]
}

export interface OpenId4VcSiopVerifyAuthorizationResponseOptions {
  /**
   * The authorization response received from the OpenID Provider (OP).
   */
  authorizationResponse: Record<string, unknown>
  jarmHeader?: { apu?: string; apv?: string }
  origin?: string
}

export interface OpenId4VcSiopCreateAuthorizationRequestReturn {
  authorizationRequest: string
  verificationSession: OpenId4VcVerificationSessionRecord
  // TODO: type needs to be exported. It can also be a JAR object, so we use
  // return value for now
  authorizationRequestObject: Awaited<ReturnType<typeof createOpenid4vpAuthorizationRequest>>['authRequestObject']
}

export interface OpenId4VcSiopVerifiedAuthorizationResponsePresentationExchange {
  submission: DifPresentationExchangeSubmission
  definition: DifPresentationExchangeDefinition
  presentations: Array<VerifiablePresentation>
  descriptors: DifPexPresentationWithDescriptor[]
}

export interface OpenId4VcSiopVerifiedAuthorizationResponseDcql {
  query: DcqlQuery
  presentation: DcqlPresentation
  presentationResult: DcqlPresentationResult
}

export interface OpenId4VcSiopVerifiedAuthorizationResponse {
  presentationExchange?: OpenId4VcSiopVerifiedAuthorizationResponsePresentationExchange
  dcql?: OpenId4VcSiopVerifiedAuthorizationResponseDcql
  transactionData?: TransactionData
}

/**
 * Verifier metadata that will be send when creating a request
 */
export interface OpenId4VcSiopVerifierClientMetadata {
  client_name?: string
  logo_uri?: string
}

export interface OpenId4VcSiopCreateVerifierOptions {
  /**
   * Id of the verifier, not the id of the verifier record. Will be exposed publicly
   */
  verifierId?: string

  /**
   * Optional client metadata that will be included in requests
   */
  clientMetadata?: OpenId4VcSiopVerifierClientMetadata
}

export type OpenId4VcUpdateVerifierRecordOptions = Pick<OpenId4VcVerifierRecordProps, 'verifierId' | 'clientMetadata'>
