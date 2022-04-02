import jsigs from '@digitalcredentials/jsonld-signatures'

import { KeyType } from '../../crypto'
import { Ed25519Signature2018 } from '../../crypto/signature-suites'
import { AriesFrameworkError } from '../../error'

const LinkedDataSignature = jsigs.suites.LinkedDataSignature

export interface SuiteInfo {
  suiteClass: typeof LinkedDataSignature
  proofType: string
  requiredKeyType: string
  keyType: string
}

export class SignatureSuiteRegistry {
  private suiteMapping: SuiteInfo[] = [
    {
      suiteClass: Ed25519Signature2018,
      proofType: 'Ed25519Signature2018',
      requiredKeyType: 'Ed25519VerificationKey2018',
      keyType: KeyType.Ed25519,
    },
  ]

  public get supportedProofTypes(): string[] {
    return this.suiteMapping.map((x) => x.proofType)
  }

  public getByKeyType(keyType: KeyType) {
    return this.suiteMapping.find((x) => x.keyType === keyType)
  }

  public getByProofType(proofType: string) {
    const suiteInfo = this.suiteMapping.find((x) => x.proofType === proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`No signature suite for proof type: ${proofType}`)
    }

    return suiteInfo
  }
}
