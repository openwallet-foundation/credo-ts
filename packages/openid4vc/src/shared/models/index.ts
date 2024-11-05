import {
  CredentialConfigurationSupported,
  CredentialConfigurationSupportedWithFormats,
  CredentialIssuerMetadata,
  CredentialRequest,
  CredentialRequestWithFormats,
} from '@animo-id/oid4vci'
import type {
  VerifiedAuthorizationRequest,
  AuthorizationRequestPayload,
  AuthorizationResponsePayload,
  IDTokenPayload,
} from '@sphereon/did-auth-siop'
import { CredentialOfferObject } from '@animo-id/oid4vci'
import { PreAuthorizedCodeGrantIdentifier } from '@animo-id/oauth2'

export type OpenId4VciCredentialConfigurationSupportedWithFormats = CredentialConfigurationSupportedWithFormats
export type OpenId4VciCredentialConfigurationSupported = CredentialConfigurationSupported

export type OpenId4VciCredentialConfigurationsSupported = Record<string, OpenId4VciCredentialConfigurationSupported>
export type OpenId4VciCredentialConfigurationsSupportedWithFormats = Record<
  string,
  OpenId4VciCredentialConfigurationSupported
>

// TODO: export in @animo-id/oid4vc
export type OpenId4VciTxCode = NonNullable<
  NonNullable<NonNullable<CredentialOfferObject['grants']>[PreAuthorizedCodeGrantIdentifier]>['tx_code']
>

export type OpenId4VciIssuerMetadata = CredentialIssuerMetadata

// TODO: export in @animo-id/oid4vc
export type OpenId4VciIssuerMetadataDisplay = NonNullable<CredentialIssuerMetadata['display']>[number]

export type OpenId4VciCredentialRequest = CredentialRequest
export type OpenId4VciCredentialRequestWithFormats = CredentialRequestWithFormats

export type OpenId4VciCredentialOfferPayload = CredentialOfferObject

export type OpenId4VcSiopVerifiedAuthorizationRequest = VerifiedAuthorizationRequest
export type OpenId4VcSiopAuthorizationRequestPayload = AuthorizationRequestPayload
export type OpenId4VcSiopAuthorizationResponsePayload = AuthorizationResponsePayload
export type OpenId4VcSiopIdTokenPayload = IDTokenPayload

export * from './OpenId4VcJwtIssuer'
export * from './CredentialHolderBinding'
export * from './OpenId4VciCredentialFormatProfile'
export * from './AuthorizationServer'
