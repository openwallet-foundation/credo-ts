import type { VerificationMethod, W3cCredential } from '@aries-framework/core'
import type {
  CredentialOfferFormat,
  CredentialOfferPayloadV1_0_11,
  CredentialRequestV1_0_11,
  CredentialSupported,
  MetadataDisplay,
  ProofOfPossession,
} from '@sphereon/oid4vci-common'

// If the entry is an object, the object contains the data related to a certain credential type
// the Wallet MAY request. Each object MUST contain a format Claim determining the format
// and further parameters characterizing by the format of the credential to be requested.
export type OfferedCredential = CredentialOfferFormat | string

export type PreAuthorizedCodeFlowConfig = {
  preAuthorizedCode: string
  userPinRequired: boolean
}

export type AuthorizationCodeFlowConfig = {
  issuerState: string
}

export type IssuerMetadata = {
  // The Credential Issuer's identifier. (URL using the https scheme)
  credentialIssuer: string
  credentialEndpoint: string
  tokenEndpoint: string
  authorizationServer?: string
  issuerDisplay?: MetadataDisplay

  credentialsSupported: CredentialSupported[]
}

export interface CreateCredentialOfferOptions {
  // The scheme used for the credentialIssuer. Default is https
  scheme?: 'http' | 'https' | 'openid-credential-offer' | string
  // The base URI of the credential offer uri
  baseUri: string

  preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig
  authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig

  credentialOfferUri?: string

  issuerMetadata?: IssuerMetadata
}

export type CredentialOfferPayload = CredentialOfferPayloadV1_0_11

export type CredentialOfferAndRequest = {
  credentialOffer: CredentialOfferPayload
  credentialOfferRequest: string
}

export type CredentialRequest = CredentialRequestV1_0_11 & { proof: ProofOfPossession }

export interface IssueCredentialOptions {
  credentialRequest: CredentialRequest
  credential: W3cCredential
  verificationMethod: VerificationMethod
  issuerMetadata?: IssuerMetadata
}
