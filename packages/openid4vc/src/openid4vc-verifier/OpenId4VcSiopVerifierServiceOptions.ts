import type {
  OpenId4VcJwtIssuer,
  OpenId4VcSiopAuthorizationRequestPayload,
  OpenId4VcSiopAuthorizationResponsePayload,
  OpenId4VcSiopIdTokenPayload,
} from '../shared'
import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  W3cVerifiablePresentation,
  SdJwtVc,
  DifPresentationExchangeDefinitionV2,
} from '@aries-framework/core'

export interface OpenId4VcSiopCreateAuthorizationRequestOptions {
  /**
   * Signing information for the request JWT. This will be used to sign the request JWT
   * and to set the client_id for registration of client_metadata.
   */
  requestSigner: OpenId4VcJwtIssuer

  /**
   * A DIF Presentation Definition (v2) can be provided to request a Verifiable Presentation using OpenID4VP.
   */
  presentationDefinition?: DifPresentationExchangeDefinitionV2
}

export interface OpenId4VcSiopVerifyAuthorizationResponseOptions {
  /**
   * The authorization response received from the OpenID Provider (OP).
   */
  authorizationResponse: OpenId4VcSiopAuthorizationResponsePayload
}

export interface OpenId4VcSiopCreateAuthorizationRequestReturn {
  authorizationRequestUri: string
  authorizationRequestPayload: OpenId4VcSiopAuthorizationRequestPayload
}

/**
 * Either `idToken` and/or `presentationExchange` will be present, but not none.
 */
export interface OpenId4VcSiopVerifiedAuthorizationResponse {
  idToken?: {
    payload: OpenId4VcSiopIdTokenPayload
  }

  presentationExchange?: {
    submission: DifPresentationExchangeSubmission
    definition: DifPresentationExchangeDefinition
    presentations: Array<W3cVerifiablePresentation | SdJwtVc>
  }
}
