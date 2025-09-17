export interface Proof {
  type: string
  cryptosuite: string
  proofPurpose: string
  verificationMethod: string
  proofValue: string
}

export interface AttestedResource {
  '@context': string | string[]
  id: string
  type: object
  content: Map<string, string | object>
  metadata?: Map<string, string>
  links?: object
  proof: Proof
}
