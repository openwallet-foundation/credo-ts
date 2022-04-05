import type { ProofPurpose } from '../../../crypto/signature-suites'
import type { SingleOrArray } from '../../../utils/type'
import type { W3cCredential } from './credential/W3cCredential'
import type { W3cVerifiableCredential } from './credential/W3cVerifiableCredential'
import type { W3cPresentation } from './presentation/W3Presentation'
import type { W3cVerifiablePresentation } from './presentation/W3cVerifiablePresentation'
import type { Frame } from '@digitalcredentials/jsonld/jsonld-spec'

export interface SignCredentialOptions {
  credential: W3cCredential
  proofType: string // TODO replace with enum
  verificationMethod: string
  proofPurpose?: ProofPurpose
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: {
    type: string
  }
}

export interface VerifyCredentialOptions {
  credential: W3cVerifiableCredential
  proofPurpose?: ProofPurpose
}

export interface StoreCredentialOptions {
  record: W3cVerifiableCredential
}

export interface CreatePresentationOptions {
  credentials: SingleOrArray<W3cVerifiableCredential>
  id?: string
  holderUrl?: string
}

export interface SignPresentationOptions {
  presentation: W3cPresentation
  signatureType: string
  purpose: ProofPurpose
  verificationMethod: string
}

export interface VerifyPresentationOptions {
  presentation: W3cVerifiablePresentation
  proofType: string
  verificationMethod: string
  purpose: ProofPurpose
}

export interface DeriveProofOptions {
  credential: W3cVerifiableCredential
  revealDocument: Frame
  verificationMethod: string
}
