import type {
  AssertedUniformCredentialOffer,
  CredentialSupported,
  UniformCredentialRequest,
} from '@sphereon/oid4vci-common'

export type OpenId4VciCredentialSupportedWithId = CredentialSupported & { id: string }
export type OpenId4VciCredentialSupported = CredentialSupported
export type OpenId4VciCredentialRequest = UniformCredentialRequest
export type OpenId4VciCredentialOffer = AssertedUniformCredentialOffer
