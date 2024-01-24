import type {
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  VerificationMethod,
  W3cVerifiablePresentation,
  SdJwtVc,
} from '@aries-framework/core'
import type {
  IDTokenPayload,
  VerifiedOpenID4VPSubmission,
  ClientMetadataOpts,
  AuthorizationResponsePayload,
} from '@sphereon/did-auth-siop'
import type { PresentationDefinitionV1, PresentationDefinitionV2 } from '@sphereon/pex-models'

export { PassBy, SigningAlgo, SubjectType, ResponseType, Scope } from '@sphereon/did-auth-siop'

export type HolderMetadata = ClientMetadataOpts & { authorization_endpoint?: string }

export type { PresentationDefinitionV1, PresentationDefinitionV2, VerifiedOpenID4VPSubmission, IDTokenPayload }

export interface OpenId4VcCreateAuthorizationRequestOptions {
  /**
   * FIXME: should be a string or a VerificationMethod instance (or something we configure in the record?)
   * The VerificationMethod used for signing the proof request.
   */
  verificationMethod: VerificationMethod

  /**
   * FIXME: rework
   * The URL to where the holder will send the response.
   */
  verificationEndpointUrl?: string

  /**
   * The OpenID Provider (OP) configuration can be provided in three different ways:
   *  - Statically, by providing the configuration as an object conforming to {@link HolderMetadata} in the `options.openIdProvider` parameter.
   *  - Dynamically, by providing the openid `issuer` URL in the `options.openIdProvider` parameter. The metadata will be retrieved
   *    from the hosted OpenID configuration endpoint.
   *  - Using a static configuration as defined in [SIOPv2](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-static-configuration-values). The following
   *    static configurations are supported, identified by the value of the `authorization_endpoint`:
   *      - `siopv2:` - Supporting `id_token` as a `response_type`. See [`siopv2:`](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-a-set-of-static-configurati)
   *      - `openid:` - Supporting both `vp_token` and `id_token` as a `response_type`. See [`openid:`](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-a-set-of-static-configuratio)
   *
   * Note that `siopv2:` CAN NOT be used if a presentation definition is provided in the `presentationDefinition` parameter. If no value is supplied, the following defaults will be used as the `openIdProvider`:
   *  - `siopv2:` - If no presentation definition is provided
   *  - `openid:` - If a presentation definition is provided.
   */
  openIdProvider?: HolderMetadata | string

  /**
   * A DIF Presentation Definition (v2) can be provided to request a Verifiable Presentation using OpenID4VP.
   */
  presentationDefinition?: PresentationDefinitionV2
}

export interface OpenId4VcVerifyAuthorizationResponseOptions {
  /**
   * The authorization response received from the OpenID Provider (OP).
   */
  authorizationResponse: OpenId4VcAuthorizationResponse
}

export interface OpenId4VcAuthorizationRequestMetadata {
  correlationId: string
  nonce: string
  state: string
}

export interface OpenId4VcAuthorizationRequestWithMetadata {
  authorizationRequestUri: string
  metadata: OpenId4VcAuthorizationRequestMetadata
}

export interface VerifyProofResponseOptions {
  createProofRequestOptions: OpenId4VcCreateAuthorizationRequestOptions
  proofRequestMetadata: OpenId4VcAuthorizationRequestMetadata
}

export interface VerifiedOpenId4VcAuthorizationResponse {
  idTokenPayload: IDTokenPayload
  presentationExchange:
    | {
        submission: DifPresentationExchangeSubmission
        definitions: DifPresentationExchangeDefinition[]
        presentations: Array<W3cVerifiablePresentation | SdJwtVc>
      }
    | undefined
}

export type OpenId4VcAuthorizationResponse = AuthorizationResponsePayload
