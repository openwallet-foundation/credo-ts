import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { PublicJwk, type SupportedPublicJwkClass } from '../../kms/jwk/PublicJwk'

import { suites } from './adapters/jsonld-signatures-adapter'

const LinkedDataSignature = suites.LinkedDataSignature

export interface SuiteInfo {
  suiteClass: typeof LinkedDataSignature
  proofType: string
  verificationMethodTypes: string[]
  supportedPublicJwkTypes: SupportedPublicJwkClass[]
}

@injectable()
export class SignatureSuiteRegistry {
  private suiteMapping: SuiteInfo[]

  public constructor(suites: SuiteInfo[] = []) {
    this.suiteMapping = [...suites]
  }

  public get supportedProofTypes(): string[] {
    return this.suiteMapping.map((x) => x.proofType)
  }

  public getAllByPublicJwkType(publicJwkType: SupportedPublicJwkClass | PublicJwk) {
    const publicJwkClass = publicJwkType instanceof PublicJwk ? publicJwkType.JwkClass : publicJwkType
    return this.suiteMapping.filter((x) => x.supportedPublicJwkTypes.includes(publicJwkClass))
  }

  public getByProofType(proofType: string) {
    const suiteInfo = this.suiteMapping.find((x) => x.proofType === proofType)

    if (!suiteInfo) {
      throw new CredoError(`No signature suite for proof type: ${proofType}`)
    }

    return suiteInfo
  }

  /**
   * Returns the `@context` url that the signature suite for the given proof type adds to documents
   * it signs (see `LinkedDataSignature.ensureSuiteContext`), or undefined if the proof type is not
   * registered or its suite does not declare a context url.
   */
  public findContextUrlByProofType(proofType: string): string | undefined {
    const suiteClass = this.suiteMapping.find((x) => x.proofType === proofType)?.suiteClass as
      | { CONTEXT_URL?: unknown }
      | undefined

    return typeof suiteClass?.CONTEXT_URL === 'string' ? suiteClass.CONTEXT_URL : undefined
  }

  public getVerificationMethodTypesByProofType(proofType: string): string[] {
    const suiteInfo = this.suiteMapping.find((suiteInfo) => suiteInfo.proofType === proofType)

    if (!suiteInfo) {
      throw new CredoError(`No verification method type found for proof type: ${proofType}`)
    }

    return suiteInfo.verificationMethodTypes
  }
}
