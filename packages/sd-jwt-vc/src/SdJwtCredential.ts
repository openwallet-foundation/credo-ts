import type { SdJwtVcPayload } from './SdJwtVcOptions'
import type { HashName, JwaSignatureAlgorithm } from '@aries-framework/core'
import type { DisclosureFrame } from '@sd-jwt/core'

export interface SdJwtCredentialOptions<Payload extends SdJwtVcPayload = SdJwtVcPayload> {
  payload: Payload
  holderDidUrl: string
  issuerDidUrl: string
  disclosureFrame?: DisclosureFrame<Payload>
  jsonWebAlgorithm?: JwaSignatureAlgorithm
  hashingAlgorithm?: HashName
}

export class SdJwtCredential<Payload extends SdJwtVcPayload = SdJwtVcPayload> {
  public constructor(options: SdJwtCredentialOptions<Payload>) {
    this.payload = options.payload
    this.holderDidUrl = options.holderDidUrl
    this.issuerDidUrl = options.issuerDidUrl
    this.disclosureFrame = options.disclosureFrame
    this.jsonWebAlgorithm = options.jsonWebAlgorithm
    this.hashingAlgorithm = options.hashingAlgorithm ?? 'sha2-256'
  }

  public payload: Payload
  public holderDidUrl: string
  public issuerDidUrl: string
  public disclosureFrame?: DisclosureFrame<Payload>
  public jsonWebAlgorithm?: JwaSignatureAlgorithm
  public hashingAlgorithm?: HashName
}
