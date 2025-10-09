import type {
  VerifiedAuthorizationRequest,
  AuthorizationRequestPayload,
  AuthorizationResponsePayload,
  IDTokenPayload,
} from '@sphereon/did-auth-siop'
import type {
  AssertedUniformCredentialOffer,
  CredentialConfigurationSupportedV1_0_13,
  CredentialIssuerMetadataV1_0_11,
  CredentialIssuerMetadataV1_0_13,
  CredentialOfferPayloadV1_0_11,
  CredentialOfferPayloadV1_0_13,
  CredentialRequestJwtVcJson,
  CredentialRequestJwtVcJsonLdAndLdpVc,
  CredentialRequestSdJwtVc,
  CredentialsSupportedLegacy,
  MetadataDisplay,
  TxCode,
} from '@sphereon/oid4vci-common'

export type OpenId4VciCredentialSupportedWithId = CredentialsSupportedLegacy & { id: string }
export type OpenId4VciCredentialSupported = CredentialsSupportedLegacy
export type OpenId4VciCredentialConfigurationSupported = CredentialConfigurationSupportedV1_0_13
export type OpenId4VciCredentialConfigurationsSupported = Record<string, OpenId4VciCredentialConfigurationSupported>
export type OpenId4VciTxCode = TxCode
export type OpenId4VciIssuerMetadata = CredentialIssuerMetadataV1_0_11 | CredentialIssuerMetadataV1_0_13
export type OpenId4VciIssuerMetadataDisplay = MetadataDisplay

export type OpenId4VciCredentialRequest =
  | CredentialRequestJwtVcJson
  | CredentialRequestJwtVcJsonLdAndLdpVc
  | CredentialRequestSdJwtVc

export type OpenId4VciCredentialRequestJwtVcJson = CredentialRequestJwtVcJson
export type OpenId4VciCredentialRequestJwtVcJsonLdAndLdpVc = CredentialRequestJwtVcJsonLdAndLdpVc
export type OpenId4VciCredentialRequestSdJwtVc = CredentialRequestSdJwtVc
export type OpenId4VciCredentialOffer = AssertedUniformCredentialOffer
export type OpenId4VciCredentialOfferPayload = CredentialOfferPayloadV1_0_11 | CredentialOfferPayloadV1_0_13

export type OpenId4VcSiopVerifiedAuthorizationRequest = VerifiedAuthorizationRequest
export type OpenId4VcSiopAuthorizationRequestPayload = AuthorizationRequestPayload
export type OpenId4VcSiopAuthorizationResponsePayload = AuthorizationResponsePayload
export type OpenId4VcSiopIdTokenPayload = IDTokenPayload

export * from './OpenId4VcJwtIssuer'
export * from './CredentialHolderBinding'
export * from './OpenId4VciCredentialFormatProfile'
