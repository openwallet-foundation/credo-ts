import type { SignCredentialOptionsRFC0593 } from '../../../vc/models/W3cCredentialServiceOptions'
import type { CredentialFormat } from '../CredentialFormat'

export interface JsonLdCredentialFormat extends CredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: SignCredentialOptionsRFC0593
    acceptProposal: SignCredentialOptionsRFC0593
    createOffer: SignCredentialOptionsRFC0593
    acceptOffer: SignCredentialOptionsRFC0593
    createRequest: SignCredentialOptionsRFC0593
    acceptRequest: SignCredentialOptionsRFC0593
  }
}
