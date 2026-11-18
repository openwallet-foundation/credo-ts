import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { getPublicJwkFromVerificationMethod } from '../../dids/domain/key-type/keyDidMapping'
import type { VerificationMethod } from '../../dids/domain/verificationMethod'
import { PublicJwk, type SupportedPublicJwkClass } from '../../kms/jwk/PublicJwk'

import { suites } from './adapters/jsonld-signatures-adapter'

const LinkedDataSignature = suites.LinkedDataSignature

/**
 * @deprecated Registration token retained for backward compatibility.
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
  private suiteMapping: SuiteInfo[]

  public constructor(suites: SuiteInfo[] = []) {
    this.suiteMapping = [...suites]
  }

  /**
   * @deprecated Pass suites to the constructor instead.
   * Will be removed in 0.8.
   */
  public registerSuite(suiteInfo: SuiteInfo) {
    this.suiteMapping.push(suiteInfo)
  }

  /**
   * @deprecated Pass suites to the constructor instead.
   * Will be removed in 0.8.
   */
  public registerSuites(suites: SuiteInfo[]) {
    for (const suite of suites) {
      this.registerSuite(suite)
    }
  }

  public get supportedProofTypes(): string[] {
    return this.suiteMapping.map((x) => x.proofType)
  }

  /**
   * @deprecated use {@link getAllByVerificationMethod}, which also checks the key type
   */
  public getByVerificationMethodType(verificationMethodType: string) {
    return this.suiteMapping.find((x) => x.verificationMethodTypes.includes(verificationMethodType))
  }

  public getAllByPublicJwkType(publicJwkType: SupportedPublicJwkClass | PublicJwk) {
    const publicJwkClass = publicJwkType instanceof PublicJwk ? publicJwkType.JwkClass : publicJwkType
    return this.suiteMapping.filter((x) => x.supportedPublicJwkTypes.includes(publicJwkClass))
  }

  /**
   * Returns the suites that can sign with the given verification method, in registration order.
   * Matching on key type alone is not enough, as a suite only accepts its own verification method types.
   */
  public getAllByVerificationMethod(verificationMethod: VerificationMethod) {
    const suitesForType = this.suiteMapping.filter((x) => x.verificationMethodTypes.includes(verificationMethod.type))
    // Checked first so a method type no suite lists returns [] instead of failing to read its key
    if (suitesForType.length === 0) return []

    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    return suitesForType.filter((x) => x.supportedPublicJwkTypes.includes(publicJwk.JwkClass))
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
