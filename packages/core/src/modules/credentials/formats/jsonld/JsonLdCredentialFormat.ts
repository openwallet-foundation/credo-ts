import type { SignCredentialOptions } from '../../../vc/models/W3cCredentialServiceOptions'
import type { CredentialFormat } from '../CredentialFormat'

export interface JsonLdCredentialFormat extends CredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: SignCredentialOptions
    acceptProposal: SignCredentialOptions
    createOffer: SignCredentialOptions
    acceptOffer: SignCredentialOptions
    createRequest: SignCredentialOptions
    acceptRequest: SignCredentialOptions
  }
}
