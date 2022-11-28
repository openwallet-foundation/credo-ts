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

type EmptyObject = Record<any, never>

export interface JsonLdCredentialFormat extends CredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: SignCredentialOptionsRFC0593
    acceptProposal: EmptyObject
    createOffer: SignCredentialOptionsRFC0593
    acceptOffer: EmptyObject
    createRequest: SignCredentialOptionsRFC0593
    acceptRequest: JsonLdAcceptRequestOptions
  }
}
