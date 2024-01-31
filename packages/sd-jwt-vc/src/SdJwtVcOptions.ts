import type { HashName, JwaSignatureAlgorithm } from '@credo-ts/core'
import type { DisclosureFrame } from 'jwt-sd'

export type SdJwtVcCreateOptions<Payload extends Record<string, unknown> = Record<string, unknown>> = {
  holderDidUrl: string
  issuerDidUrl: string
  jsonWebAlgorithm?: JwaSignatureAlgorithm
  disclosureFrame?: DisclosureFrame<Payload>
  hashingAlgorithm?: HashName
}

export type SdJwtVcReceiveOptions = {
  issuerDidUrl: string
  holderDidUrl: string
}

/**
 * `includedDisclosureIndices` is not the best API, but it is the best alternative until something like `PEX` is supported
 */
export type SdJwtVcPresentOptions = {
  jsonWebAlgorithm?: JwaSignatureAlgorithm
  includedDisclosureIndices?: Array<number>

  /**
   * This information is received out-of-band from the verifier.
   * The claims will be used to create a normal JWT, used for key binding.
   */
  verifierMetadata: {
    verifierDid: string
    nonce: string
    issuedAt: number
  }
}

/**
 * `requiredClaimKeys` is not the best API, but it is the best alternative until something like `PEX` is supported
 */
export type SdJwtVcVerifyOptions = {
  holderDidUrl: string
  challenge: {
    verifierDid: string
  }
  requiredClaimKeys?: Array<string>
}
