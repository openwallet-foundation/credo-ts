import type {
  AgentContext,
  CanBePromise,
  DcqlCredentialsForRequest,
  DcqlQueryResult,
  DifPexCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  EncodedX509Certificate,
} from '@credo-ts/core'
import { ResolvedOpenid4vpAuthorizationRequest } from '@openid4vc/openid4vp'
import type { OpenId4VpAuthorizationRequestPayload } from '../shared'

// TODO: export from oid4vp
export type ParsedTransactionDataEntry = NonNullable<ResolvedOpenid4vpAuthorizationRequest['transactionData']>[number]

export type VerifyAuthorizationRequestOptions = {
  agentContext: AgentContext
} & Pick<OpenId4VpResolvedAuthorizationRequest, 'authorizationRequestPayload' | 'signedAuthorizationRequest' | 'origin'>

export type VerifyAuthorizationRequestCallback = (options: VerifyAuthorizationRequestOptions) => CanBePromise<void>

export interface ResolveOpenId4VpAuthorizationRequestOptions {
  trustedCertificates?: EncodedX509Certificate[]
  origin?: string
  verifyAuthorizationRequestCallback?: VerifyAuthorizationRequestCallback
}

type VerifiedJarRequest = NonNullable<ResolvedOpenid4vpAuthorizationRequest['jar']>

export interface OpenId4VpResolvedAuthorizationRequest {
  /**
   * Parameters related to DIF Presentation Exchange. Only defined when
   * the request included
   */
  presentationExchange?: {
    definition: DifPresentationExchangeDefinition
    credentialsForRequest: DifPexCredentialsForRequest
  }

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
