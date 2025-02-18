import type { AccessTokenResponse } from '@openid4vc/oauth2'
import type {
  CredentialConfigurationSupported,
  CredentialConfigurationSupportedWithFormats,
  CredentialIssuerMetadata,
  CredentialIssuerMetadataDisplayEntry,
  CredentialOfferObject,
  CredentialOfferPreAuthorizedCodeGrantTxCode,
  CredentialRequest,
  CredentialRequestFormatSpecific,
  CredentialRequestWithFormats,
  IssuerMetadataResult,
  ParseCredentialRequestReturn,
} from '@openid4vc/oid4vci'
import { Openid4vpAuthorizationResponse, Openid4vpAuthorizationResponseDcApi, ResolvedOpenid4vpAuthRequest, Openid4vpAuthorizationRequest} from '@openid4vc/oid4vp'
import { Openid4vpAuthorizationRequestDcApi } from '@openid4vc/oid4vp/src/authorization-request/z-authorization-request-dc-api.js'

export { authorizationCodeGrantIdentifier, preAuthorizedCodeGrantIdentifier } from '@openid4vc/oauth2'
export { Openid4vpAuthorizationRequest} from '@openid4vc/oid4vp'

export type OpenId4VciCredentialConfigurationSupportedWithFormats = CredentialConfigurationSupportedWithFormats
export type OpenId4VciCredentialConfigurationSupported = CredentialConfigurationSupported

export type OpenId4VciCredentialConfigurationsSupported = Record<string, OpenId4VciCredentialConfigurationSupported>
export type OpenId4VciCredentialConfigurationsSupportedWithFormats = Record<
  string,
  OpenId4VciCredentialConfigurationSupportedWithFormats
>

export type OpenId4VciAccessTokenResponse = AccessTokenResponse
export type OpenId4VciMetadata = IssuerMetadataResult

export type OpenId4VciTxCode = CredentialOfferPreAuthorizedCodeGrantTxCode
export type OpenId4VciCredentialIssuerMetadata = CredentialIssuerMetadata

export type OpenId4VciParsedCredentialRequest = ParseCredentialRequestReturn
export type OpenId4VciCredentialRequestFormatSpecific = CredentialRequestFormatSpecific

export type OpenId4VciCredentialIssuerMetadataDisplay = CredentialIssuerMetadataDisplayEntry

export type OpenId4VciCredentialRequest = CredentialRequest
export type OpenId4VciCredentialRequestWithFormats = CredentialRequestWithFormats

export type OpenId4VciCredentialOfferPayload = CredentialOfferObject

export type OpenId4VcSiopVerifiedAuthorizationRequest = ResolvedOpenid4vpAuthRequest
export type OpenId4VcSiopAuthorizationRequestPayload = Openid4vpAuthorizationRequest | Openid4vpAuthorizationRequestDcApi
export type OpenId4VcSiopAuthorizationResponsePayload = Openid4vpAuthorizationResponse | Openid4vpAuthorizationResponseDcApi['data']

export * from './CredentialHolderBinding'
export * from './OpenId4VciAuthorizationServerConfig'
export * from './OpenId4VciCredentialFormatProfile'
export * from './OpenId4VcJwtIssuer'
