import type { KeyType } from '../../../crypto'

import { CredoError } from '../../../error'
import { injectAll, injectable } from '../../../plugins'

import { suites } from './libraries/jsonld-signatures'

const LinkedDataSignature = suites.LinkedDataSignature

export const SignatureSuiteToken = Symbol('SignatureSuiteToken')
export interface SuiteInfo {
  suiteClass: typeof LinkedDataSignature
  proofType: string
  verificationMethodTypes: string[]
  keyTypes: KeyType[]
}

@injectable()
export class SignatureSuiteRegistry {
  private suiteMapping: SuiteInfo[]

  public constructor(@injectAll(SignatureSuiteToken) suites: Array<SuiteInfo | 'default'>) {
    this.suiteMapping = suites.filter((suite): suite is SuiteInfo => suite !== 'default')
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

  public getAllByKeyType(keyType: KeyType) {
    return this.suiteMapping.filter((x) => x.keyTypes.includes(keyType))
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
