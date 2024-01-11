import type { Jwk } from '@aries-framework/core'

export type CredentialHolderDidBinding = {
  method: 'did'
  didUrl: string
}

export type CredentialHolderJwkBinding = {
  method: 'jwk'
  jwk: Jwk
}

export type CredentialHolderBinding = CredentialHolderDidBinding | CredentialHolderJwkBinding
