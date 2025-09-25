export interface ProofOptions {
  type: string
  cryptosuite: string
  proofPurpose: string
  verificationMethod: string
}

export interface Proof {
  type: string
  cryptosuite: string
  proofPurpose: string
  verificationMethod: string
  proofValue: string
}

export interface UnsecuredDocument {
  [key: string]: string | object
}

export interface SecuredDocument extends UnsecuredDocument {
  proof: Proof
}
