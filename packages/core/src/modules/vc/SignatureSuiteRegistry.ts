import type { KeyType } from '../../crypto'

import { AriesFrameworkError } from '../../error'
import { injectable, injectAll } from '../../plugins'

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

  public constructor(@injectAll(SignatureSuiteToken) suites: SuiteInfo[]) {
    this.suiteMapping = suites
  }

  public get supportedProofTypes(): string[] {
    return this.suiteMapping.map((x) => x.proofType)
  }

  public getByVerificationMethodType(verificationMethodType: string) {
    return this.suiteMapping.find((x) => x.verificationMethodTypes.includes(verificationMethodType))
  }

  public getByKeyType(keyType: KeyType) {
    return this.suiteMapping.find((x) => x.keyTypes.includes(keyType))
  }

  public getByProofType(proofType: string) {
    const suiteInfo = this.suiteMapping.find((x) => x.proofType === proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`No signature suite for proof type: ${proofType}`)
    }

    return suiteInfo
  }

  public getVerificationMethodTypesByProofType(proofType: string): string[] {
    const suiteInfo = this.suiteMapping.find((suiteInfo) => suiteInfo.proofType === proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`No verification method type found for proof type: ${proofType}`)
    }

    return suiteInfo.verificationMethodTypes
  }
}
