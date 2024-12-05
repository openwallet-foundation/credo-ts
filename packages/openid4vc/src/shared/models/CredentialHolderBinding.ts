import type { Jwk, Key } from '@credo-ts/core'

export type OpenId4VcCredentialHolderDidBinding = {
  method: 'did'
  didUrl: string
}

export type OpenId4VcCredentialHolderJwkBinding = {
  method: 'jwk'
  jwk: Jwk
}

export type OpenId4VcCredentialHolderBinding = OpenId4VcCredentialHolderDidBinding | OpenId4VcCredentialHolderJwkBinding
export type OpenId4VcCredentialHolderBindingWithKey = OpenId4VcCredentialHolderBinding & { key: Key }
