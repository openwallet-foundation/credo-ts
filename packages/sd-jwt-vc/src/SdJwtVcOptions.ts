import type { HashName, JwaSignatureAlgorithm } from '@aries-framework/core'
import type { DisclosureFrame, PresentationFrame } from '@sd-jwt/core'

// TODO: extend with required claim names for input (e.g. vct)
export type SdJwtVcPayload = Record<string, unknown>
export type SdJwtVcHeader = Record<string, unknown>

export type SdJwtVcCreateOptions<Payload extends SdJwtVcPayload = SdJwtVcPayload> = {
  holderDidUrl: string
  issuerDidUrl: string
  jsonWebAlgorithm?: JwaSignatureAlgorithm
  disclosureFrame?: DisclosureFrame<Payload>
  hashingAlgorithm?: HashName
}

export type SdJwtVcFromSerializedJwtOptions = {
  issuerDidUrl?: string
  holderDidUrl: string
}

export type SdJwtVcPresentOptions<Payload extends SdJwtVcPayload = SdJwtVcPayload> = {
  jsonWebAlgorithm?: JwaSignatureAlgorithm
  /**
   * Use true to disclose everything
   */
  presentationFrame: PresentationFrame<Payload> | true

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

export type SdJwtVcVerifyOptions = {
  holderDidUrl: string
  challenge: {
    verifierDid: string
  }
  // TODO: update to requiredClaimFrame
  requiredClaimKeys?: Array<string>
}
