import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { PublicJwk, type SupportedPublicJwkClass } from '../../kms/jwk/PublicJwk'

import { suites } from './adapters/jsonld-signatures-adapter'

const LinkedDataSignature = suites.LinkedDataSignature

/**
 * @deprecated Register suites directly via `SignatureSuiteRegistry.registerSuites()` instead.
 * Will be removed in 0.8.
 */
export const SignatureSuiteToken = Symbol('SignatureSuiteToken')

export interface SuiteInfo {
  suiteClass: typeof LinkedDataSignature
  proofType: string
  verificationMethodTypes: string[]
  supportedPublicJwkTypes: SupportedPublicJwkClass[]
}

@injectable()
export class SignatureSuiteRegistry {
  private suiteMapping: SuiteInfo[] = []

  public registerSuite(suiteInfo: SuiteInfo) {
    this.suiteMapping.push(suiteInfo)
  }

  public registerSuites(suites: SuiteInfo[]) {
    for (const suite of suites) {
      this.registerSuite(suite)
    }
  }

  public get supportedProofTypes(): string[] {
    return this.suiteMapping.map((x) => x.proofType)
  }

  /**
   * @deprecated recommended to always search by key type instead as that will have broader support
   */
  public getByVerificationMethodType(verificationMethodType: string) {
    return this.suiteMapping.find((x) => x.verificationMethodTypes.includes(verificationMethodType))
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

  public getVerificationMethodTypesByProofType(proofType: string): string[] {
    const suiteInfo = this.suiteMapping.find((suiteInfo) => suiteInfo.proofType === proofType)

    if (!suiteInfo) {
      throw new CredoError(`No verification method type found for proof type: ${proofType}`)
    }

    return suiteInfo.verificationMethodTypes
  }
}
