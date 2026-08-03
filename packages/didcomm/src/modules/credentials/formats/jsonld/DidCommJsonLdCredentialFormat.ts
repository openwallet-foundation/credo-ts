import type { DidPurpose, JsonObject, SingleOrArray, W3cIssuerOptions } from '@credo-ts/core'
import type { DidCommCredentialFormat } from '../DidCommCredentialFormat'

export interface JsonCredential {
  '@context': Array<string> | JsonObject
  id?: string
  type: Array<string>
  issuer: string | W3cIssuerOptions

  /**
   * Data model 1.1 only. Required when the credential uses the data model 1.1 context.
   */
  issuanceDate?: string

  /**
   * Data model 1.1 only.
   */
  expirationDate?: string

  /**
   * Data model 2.0 only. Replaces {@link issuanceDate}.
   */
  validFrom?: string

  /**
   * Data model 2.0 only. Replaces {@link expirationDate}.
   */
  validUntil?: string

  credentialSubject: SingleOrArray<JsonObject>
  [key: string]: unknown
}

/**
 * Format for creating a jsonld proposal, offer or request.
 */
export interface DidCommJsonLdCredentialDetailFormat {
  credential: JsonCredential
  options: {
    proofPurpose: string
    proofType: string
  }
}

// use empty object in the acceptXXX jsonld format interface so we indicate that
// the jsonld format service needs to be invoked
type EmptyObject = Record<string, never>

/**
 * Format for accepting a jsonld credential request. Optionally allows the verification
 * method to use to sign the credential.
 */
export interface DidCommJsonLdAcceptRequestFormat {
  verificationMethod?: string
}

export interface DidCommJsonLdCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: DidCommJsonLdCredentialDetailFormat
    acceptProposal: EmptyObject
    createOffer: DidCommJsonLdCredentialDetailFormat
    acceptOffer: EmptyObject
    createRequest: DidCommJsonLdCredentialDetailFormat
    acceptRequest: DidCommJsonLdAcceptRequestFormat
  }
  formatData: {
    proposal: JsonLdFormatDataCredentialDetail
    offer: JsonLdFormatDataCredentialDetail
    request: JsonLdFormatDataCredentialDetail
    credential: JsonLdFormatDataVerifiableCredential
  }
}

/**
 * Represents a signed verifiable credential. Only meant to be used for credential
 * format data interfaces.
 */
export interface JsonLdFormatDataVerifiableCredential extends JsonCredential {
  proof: {
    type: string
    proofPurpose: string
    verificationMethod: string
    created: string
    domain?: string
    challenge?: string
    jws?: string
    proofValue?: string
    nonce?: string
    [key: string]: unknown
  }
}

/**
 * Represents the jsonld credential detail. Only meant to be used for credential
 * format data interfaces.
 */
export interface JsonLdFormatDataCredentialDetail {
  credential: JsonCredential
  options: JsonLdFormatDataCredentialDetailOptions
}

/**
 * Represents the jsonld credential detail options. Only meant to be used for credential
 * format data interfaces.
 */
export interface JsonLdFormatDataCredentialDetailOptions {
  proofPurpose?: DidPurpose
  proofType: string
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: {
    type: string
    [key: string]: unknown
  }
}
