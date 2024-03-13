import type {
  VerifiedAuthorizationRequest,
  AuthorizationRequestPayload,
  AuthorizationResponsePayload,
  IDTokenPayload,
} from '@sphereon/did-auth-siop'
import type {
  AssertedUniformCredentialOffer,
  CredentialIssuerMetadata,
  CredentialOfferPayloadV1_0_11,
  CredentialRequestJwtVcJson,
  CredentialRequestJwtVcJsonLdAndLdpVc,
  CredentialRequestSdJwtVc,
  CredentialSupported,
  MetadataDisplay,
  UniformCredentialRequest,
} from '@sphereon/oid4vci-common'

export type OpenId4VciCredentialSupportedWithId = CredentialSupported & { id: string }
export type OpenId4VciCredentialSupported = CredentialSupported
export type OpenId4VciIssuerMetadata = CredentialIssuerMetadata
export type OpenId4VciIssuerMetadataDisplay = MetadataDisplay

export type OpenId4VciCredentialRequest = UniformCredentialRequest

export type OpenId4VciCredentialRequestJwtVcJson = CredentialRequestJwtVcJson
export type OpenId4VciCredentialRequestJwtVcJsonLdAndLdpVc = CredentialRequestJwtVcJsonLdAndLdpVc
export type OpenId4VciCredentialRequestSdJwtVc = CredentialRequestSdJwtVc
export type OpenId4VciCredentialOffer = AssertedUniformCredentialOffer
export type OpenId4VciCredentialOfferPayload = CredentialOfferPayloadV1_0_11

export type OpenId4VcSiopVerifiedAuthorizationRequest = VerifiedAuthorizationRequest
export type OpenId4VcSiopAuthorizationRequestPayload = AuthorizationRequestPayload
export type OpenId4VcSiopAuthorizationResponsePayload = AuthorizationResponsePayload
export type OpenId4VcSiopIdTokenPayload = IDTokenPayload

export * from './OpenId4VcJwtIssuer'
export * from './CredentialHolderBinding'
export * from './OpenId4VciCredentialFormatProfile'
