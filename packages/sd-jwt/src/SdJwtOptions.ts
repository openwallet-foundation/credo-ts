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
  issuerDid: Key
  holderKey?: Key
}

export type SdJwtPresentOptions = {
  includedDisclosureIndices?: Array<number>
  includeHolderKey?: boolean
}

/**
 * @todo combine requiredClaims and requiredDisclosedClaims
 */
export type SdJwtVerifyOptions = {
  requiredClaims?: Array<string>
  holderKey?: Key
}
