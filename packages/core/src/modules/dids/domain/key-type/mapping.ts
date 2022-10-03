import type { Key } from '../Key'
import type { VerificationMethod } from '../verificationMethod'

export interface KeyDidMapping {
  getVerificationMethods: (did: string, key: Key) => VerificationMethod[]

  getKeyFromVerificationMethod(verificationMethod: VerificationMethod): Key

  supportedVerificationMethodTypes: string[]
}
