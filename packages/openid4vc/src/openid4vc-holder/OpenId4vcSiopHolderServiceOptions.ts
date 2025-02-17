import type {
  DcqlCredentialsForRequest,
  DcqlQueryResult,
  DcqlTransactionDataRequest,
  DifPexCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  TransactionDataRequest,
} from '@credo-ts/core'
import type { OpenId4VcJwtIssuer, OpenId4VcSiopVerifiedAuthorizationRequest } from '../shared'

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
   * The issuer of the ID Token.
   *
   * REQUIRED when presentation exchange is not used.
   *
   * In case presentation exchange is used, and `openIdTokenIssuer` is not provided, the issuer of the ID Token
   * will be extracted from the signer of the first verifiable presentation.
   */
  openIdTokenIssuer?: OpenId4VcJwtIssuer

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
