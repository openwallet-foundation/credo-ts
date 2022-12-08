import type { W3cCredential } from '../../../vc/models/credential/W3cCredential'
import type { CredentialFormat } from '../CredentialFormat'
import type { JsonLdOptionsRFC0593 } from './JsonLdOptionsRFC0593'

export interface JsonLdAcceptRequestOptions extends SignCredentialOptionsRFC0593 {
  verificationMethod?: string
}

export interface SignCredentialOptionsRFC0593 {
  credential: W3cCredential
  options: JsonLdOptionsRFC0593
}

export interface JsonLdSignCredentialFormat {
  credential: JSON
  options: JsonLdOptionsRFC0593
}

// use empty object in the acceptXXX jsonld format interface so we indicate that
// the jsonld format service needs to be invoked
type EmptyObject = Record<string, never>

// it is an option to provide the verification method in acceptRequest
export interface JsonLdCreateRequestFormat {
  verificationMethod?: string
}

export interface JsonLdCredentialFormat extends CredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: JsonLdSignCredentialFormat
    acceptProposal: EmptyObject
    createOffer: JsonLdSignCredentialFormat
    acceptOffer: EmptyObject
    createRequest: JsonLdSignCredentialFormat
    acceptRequest: JsonLdCreateRequestFormat
  }
}
