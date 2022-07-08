import { AriesFrameworkError } from '../../error'
import { injectable, injectAll } from '../../plugins'

import { suites } from './libraries/jsonld-signatures'

const LinkedDataSignature = suites.LinkedDataSignature

export const SignatureSuiteToken = Symbol('SignatureSuiteToken')
export interface SuiteInfo {
  suiteClass: typeof LinkedDataSignature
  proofType: string
  keyTypes: string[]
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
    return this.suiteMapping.find((x) => x.keyTypes.includes(verificationMethodType))
  }

  public getByProofType(proofType: string) {
    const suiteInfo = this.suiteMapping.find((x) => x.proofType === proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`No signature suite for proof type: ${proofType}`)
    }

    return suiteInfo
  }

  public getKeyTypesByProofType(proofType: string): string[] {
    const suiteInfo = this.suiteMapping.find((suiteInfo) => suiteInfo.proofType === proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`No KeyType found for proof type: ${proofType}`)
    }

    return suiteInfo.keyTypes
  }
}
