import type { W3cCredential } from '../../../vc/models/credential/W3cCredential'
import type { CredentialFormat } from '../CredentialFormat'
import type { JsonLdOptionsRFC0593 } from './JsonLdOptionsRFC0593'

export interface JsonLdAcceptRequestOptions extends SignCredentialOptionsRFC0593 {
  verificationMethod?: string
}

// feel free to rename this, the RFC suffix is useful during dev

export interface SignCredentialOptionsRFC0593 {
  credential: W3cCredential
  options: JsonLdOptionsRFC0593
}

export interface JsonLdCredentialFormat extends CredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: SignCredentialOptionsRFC0593
    acceptProposal: SignCredentialOptionsRFC0593
    createOffer: SignCredentialOptionsRFC0593
    acceptOffer: SignCredentialOptionsRFC0593
    createRequest: SignCredentialOptionsRFC0593
    acceptRequest: JsonLdAcceptRequestOptions
  }
}
