import type { HashName, Key } from '@aries-framework/core'
import type { DisclosureFrame } from 'jwt-sd'

export type SdJwtCreateOptions<Payload extends Record<string, unknown> = Record<string, unknown>> = {
  issuerDid: string
  issuerKey: Key
  disclosureFrame?: DisclosureFrame<Payload>
  holderBinding: string | Key
  hashingAlgorithm?: HashName
}

export type SdJwtReceiveOptions = {
  issuerKey: Key
  holderKey: Key
}

/**
 * `includedDisclosureIndices` is not the best API, but it is the best alternative until something like `PEX` is supported
 */
export type SdJwtPresentOptions = {
  includedDisclosureIndices?: Array<number>
  holderKey: Key

  /**
   * This information is received out-of-band from the verifier.
   * The claims will be used to create a normal JWT, used for key binding.
   */
  verifierMetadata: {
    audienceDid: string
    nonce: string
    issuedAt: number
  }
}

/**
 * `requiredClaimKeys` is not the best API, but it is the best alternative until something like `PEX` is supported
 */
export type SdJwtVerifyOptions = {
  requiredClaimKeys?: Array<string>
  holderKey: Key
  issuerKey: Key
  verifierDid: string
}
