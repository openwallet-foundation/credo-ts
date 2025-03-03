import type {
  DcqlCredentialsForRequest,
  DcqlQueryResult,
  DcqlTransactionDataRequest,
  DifPexCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  EncodedX509Certificate,
  TransactionDataRequest,
} from '@credo-ts/core'
import type { OpenId4VcSiopVerifiedAuthorizationRequest } from '../shared'

export interface ResolveSiopAuthorizationRequestOptions {
  trustedCertificates?: EncodedX509Certificate[]
  origin?: string
}

export interface OpenId4VcSiopResolvedAuthorizationRequest {
  /**
   * Parameters related to DIF Presentation Exchange. Only defined when
   * the request included
   */
  presentationExchange?: {
    definition: DifPresentationExchangeDefinition
    credentialsForRequest: DifPexCredentialsForRequest
    transactionData?: TransactionDataRequest
  }

  dcql?: {
    queryResult: DcqlQueryResult
    transactionData?: DcqlTransactionDataRequest
  }

  /**
   * The verified authorization request.
   */
  authorizationRequest: OpenId4VcSiopVerifiedAuthorizationRequest

  /**
   * Origin of the request, to be used with Digital Credentials API
   */
  origin?: string
}

export interface OpenId4VcSiopAcceptAuthorizationRequestOptions {
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
   * The verified authorization request.
   */
  authorizationRequest: OpenId4VcSiopVerifiedAuthorizationRequest

  /**
   * The origin of the verifier that is making the request.
   * Required in combination with the DC Api
   */
  origin?: string
}
