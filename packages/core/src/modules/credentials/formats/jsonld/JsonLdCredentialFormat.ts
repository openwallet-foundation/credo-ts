import type { JsonObject } from '../../../../types'
import type { SingleOrArray } from '../../../../utils'
import type { IssuerOptions } from '../../../vc/models/credential/Issuer'
import type { W3cCredential } from '../../../vc/models/credential/W3cCredential'
import type { CredentialFormat } from '../CredentialFormat'
import type { JsonLdOptionsRFC0593 } from './JsonLdOptionsRFC0593'

export interface JsonCredential {
  '@context': Array<string> | JsonObject
  id?: string
  type: Array<string>
  issuer: string | IssuerOptions
  issuanceDate: string
  expirationDate?: string
  credentialSubject: SingleOrArray<JsonObject>
}
export interface JsonLdSignCredentialFormat {
  credential: JsonCredential
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
  formatData: {
    proposal: JsonLdSignCredentialFormat
    offer: JsonLdSignCredentialFormat
    request: JsonLdSignCredentialFormat
    credential: W3cCredential
  }
}
