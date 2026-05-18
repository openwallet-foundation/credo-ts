import type { AgentContext } from '../../../agent/context'
import type { SupportedPublicJwkClass } from '../../kms/jwk/PublicJwk'
import type {
  DataIntegrityCryptosuiteProof,
  DataIntegrityCryptosuiteProofOptions,
  DataIntegrityUnsecuredDocument,
} from '../DataIntegrityProof'

export const DataIntegrityCryptosuiteToken = Symbol('DataIntegrityCryptosuiteToken')

export type DataIntegrityCryptosuiteClass = new (agentContext: AgentContext) => DataIntegrityCryptosuite

export interface DataIntegrityCryptosuiteInfo {
  cryptosuiteClass: DataIntegrityCryptosuiteClass
  cryptosuite: string
  supportedPublicJwkTypes: SupportedPublicJwkClass[]
}

export interface DataIntegrityProofVerificationInput {
  unsecuredDocument: DataIntegrityUnsecuredDocument
  proof: DataIntegrityCryptosuiteProof
}

export interface DataIntegrityProofVerificationResult {
  verified: boolean
  verifiedDocument: DataIntegrityUnsecuredDocument | null
}

export interface DataIntegrityCryptosuite {
  readonly cryptosuite: string
  createProof(
    unsecuredDocument: DataIntegrityUnsecuredDocument,
    options: DataIntegrityCryptosuiteProofOptions
  ): Promise<DataIntegrityCryptosuiteProof>
  verifyProof(input: DataIntegrityProofVerificationInput): Promise<DataIntegrityProofVerificationResult>
}
