import type { AgentContext } from '../../../agent/context'
import type { SupportedPublicJwkClass } from '../../kms/jwk/PublicJwk'
import type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityUnsecuredDocument,
} from '../W3cDataIntegrityProof'

export const W3cDataIntegrityCryptosuiteToken = Symbol('W3cDataIntegrityCryptosuiteToken')

export type W3cDataIntegrityCryptosuiteClass = new (agentContext: AgentContext) => W3cDataIntegrityCryptosuite

export interface W3cDataIntegrityCryptosuiteInfo {
  cryptosuiteClass: W3cDataIntegrityCryptosuiteClass
  cryptosuite: string
  supportedPublicJwkTypes: SupportedPublicJwkClass[]
}

export interface W3cDataIntegrityProofVerificationInput {
  unsecuredDocument: W3cDataIntegrityUnsecuredDocument
  proof: W3cDataIntegrityCryptosuiteProof
}

export interface W3cDataIntegrityProofVerificationResult {
  verified: boolean
  verifiedDocument: W3cDataIntegrityUnsecuredDocument | null
}

export interface W3cDataIntegrityCryptosuite {
  readonly cryptosuite: string
  createProof(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ): Promise<W3cDataIntegrityCryptosuiteProof>
  verifyProof(input: W3cDataIntegrityProofVerificationInput): Promise<W3cDataIntegrityProofVerificationResult>
}
