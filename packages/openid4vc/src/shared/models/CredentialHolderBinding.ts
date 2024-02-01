import type { Jwk } from '@credo-ts/core'

export type OpenId4VcCredentialHolderDidBinding = {
  method: 'did'
  didUrl: string
}

export type OpenId4VcCredentialHolderJwkBinding = {
  method: 'jwk'
  jwk: Jwk
}

export type OpenId4VcCredentialHolderBinding = OpenId4VcCredentialHolderDidBinding | OpenId4VcCredentialHolderJwkBinding
