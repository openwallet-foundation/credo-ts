import { canonicalizeEx } from 'json-canonicalize'

import type { AgentContext } from '../../../../agent/context'
import { Hasher } from '../../../../crypto'
import { asArray, MultiBaseEncoder, TypedArrayEncoder } from '../../../../utils'
import { isObject } from '../../../../utils/object'
import { KeyManagementApi } from '../../../kms'
import { isXsdDateTimeStamp } from '../../proof-processing/iso8601-datetime'
import { publicJwkFromVerificationMethodId, publicKeyIdFromVerificationMethodId } from '../../proof-processing/keyUtils'
import { omitUndefinedFields } from '../../proof-processing/normalisation'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../../W3cDataIntegrityError'
import type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityUnsecuredDocument,
} from '../../W3cDataIntegrityProof'
import type {
  W3cDataIntegrityCryptosuite,
  W3cDataIntegrityProofVerificationInput,
  W3cDataIntegrityProofVerificationResult,
} from '../types'

export class EddsaJcs2022Cryptosuite implements W3cDataIntegrityCryptosuite {
  public readonly cryptosuite = 'eddsa-jcs-2022'
  private keyManagementApi: KeyManagementApi
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.keyManagementApi = agentContext.dependencyManager.resolve(KeyManagementApi)
  }

  private canonicalizeJcsStrict(value: unknown) {
    const normalised = omitUndefinedFields(value)
    assertJcsInput(normalised)
    return canonicalizeEx(normalised, {
      allowCircular: false,
      filterUndefined: true,
      undefinedInArrayToNull: false,
    })
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.1
   * https://www.w3.org/TR/vc-di-eddsa/#create-proof-eddsa-jcs-2022
   */
  public async createProof(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ): Promise<W3cDataIntegrityCryptosuiteProof> {
    // Boundary contract: callers must pass DataIntegrityProof + eddsa-jcs-2022 options.
    // W3cDataIntegrityProofService is the normal enforcement gate, but this guard protects
    // direct callers as well and keeps failures close to cryptosuite entry points.
    this.assertProofTypeAndCryptosuite(options, W3cDataIntegrityProcessingErrorCode.ProofGenerationError, 'createProof')

    const proof: W3cDataIntegrityCryptosuiteProofOptions = { ...options } // 1

    if ('@context' in unsecuredDocument) {
      proof['@context'] = unsecuredDocument['@context']
    } // 2

    const proofConfig = this.proofConfiguration(proof) // 3
    const transformedDocument = this.transformation(unsecuredDocument, options) // 4
    const hashData = this.hashing(transformedDocument, proofConfig) // 5
    const proofBytes = await this.proofSerialization(hashData, options) // 6
    const proofValue = MultiBaseEncoder.encode(proofBytes, 'base58btc') // 7

    return {
      ...proof,
      proofValue,
    } // 8
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.2
   * https://www.w3.org/TR/vc-di-eddsa/#verify-proof-eddsa-jcs-2022
   */
  public async verifyProof(
    input: W3cDataIntegrityProofVerificationInput
  ): Promise<W3cDataIntegrityProofVerificationResult> {
    const { unsecuredDocument: securedDocument, proof } = input
    const unsecuredDocument: W3cDataIntegrityUnsecuredDocument = { ...securedDocument } // 1
    const { proofValue, ...proofOptions } = proof // 2

    // Boundary contract: when verifyProof is called directly, validate proof suite
    // identity before running cryptographic verification.
    this.assertProofTypeAndCryptosuite(
      proofOptions,
      W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
      'verifyProof'
    )

    const proofBytes = MultiBaseEncoder.decode(proofValue).data // 3

    if ('@context' in proofOptions) {
      // 4
      const proofContext = asArray(proofOptions['@context'])
      const documentContext = asArray(unsecuredDocument['@context'])

      const hasMatchingContext =
        documentContext.length >= proofContext.length &&
        proofContext.every((value, index) => documentContext[index] === value) // 4.1

      if (!hasMatchingContext) {
        return {
          verified: false,
          verifiedDocument: null,
        } // 4.1
      }

      unsecuredDocument['@context'] = proofOptions['@context'] // 4.2
    }

    const transformedDocument = this.transformation(unsecuredDocument, proofOptions) // 5
    const proofConfig = this.proofConfiguration(proofOptions) // 6
    const hashData = this.hashing(transformedDocument, proofConfig) // 7
    const verified = await this.proofVerification(hashData, proofBytes, proofOptions) // 8

    return {
      verified,
      verifiedDocument: verified ? unsecuredDocument : null,
    } // 9
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.3
   * https://www.w3.org/TR/vc-di-eddsa/#transformation-eddsa-jcs-2022
   */
  public transformation(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    proofOptions: W3cDataIntegrityCryptosuiteProofOptions
  ) {
    if (proofOptions.type !== 'DataIntegrityProof' || proofOptions.cryptosuite !== 'eddsa-jcs-2022') {
      const err = `Proof type must be 'DataIntegrityProof' AND cryptosuite must be 'eddsa-jcs-2022'`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
    } // 1

    const canonicalDocument = this.canonicalizeJcsStrict(unsecuredDocument) // 2
    return canonicalDocument // 3
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.4
   * https://www.w3.org/TR/vc-di-eddsa/#hashing-eddsa-jcs-2022
   */
  public hashing(transformedDocument: string, canonicalProofConfig: string) {
    const transformedDocumentHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(transformedDocument), 'sha-256') // 1
    const proofConfigHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(canonicalProofConfig), 'sha-256') // 2
    const hashData = new Uint8Array(64) // 3 create empty 64-byte array
    hashData.set(proofConfigHash, 0) // 3 append proofConfigHash from 0-31
    hashData.set(transformedDocumentHash, 32) // 3 append transformedDocumentHash from 32-63
    return hashData // 4
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.5
   * https://www.w3.org/TR/vc-di-eddsa/#proof-configuration-eddsa-jcs-2022
   */
  public proofConfiguration(proofOptions: W3cDataIntegrityCryptosuiteProofOptions) {
    const proofConfig = { ...proofOptions } // 1

    if (proofConfig.type !== 'DataIntegrityProof' || proofConfig.cryptosuite !== 'eddsa-jcs-2022') {
      const err = `Proof type must be 'DataIntegrityProof' AND cryptosuite must be 'eddsa-jcs-2022'`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofGenerationError, err)
    }

    if (typeof proofConfig.created === 'string' && !isXsdDateTimeStamp(proofConfig.created)) {
      const err = `Proof created must be a valid dateTimeStamp. Received '${proofConfig.created}'`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofGenerationError, err)
    }

    const canonicalProofConfig = this.canonicalizeJcsStrict(proofConfig) // 4
    return canonicalProofConfig // 5
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.6
   * https://www.w3.org/TR/vc-di-eddsa/#proof-serialization-eddsa-jcs-2022
   */
  public async proofSerialization(hashData: Uint8Array, options: W3cDataIntegrityCryptosuiteProofOptions) {
    // Caller (W3cDataIntegrityProofService) is responsible for required-member and suite-shape validation before invocation.
    // This method intentionally focuses on §3.3.6 signing semantics only.

    const verificationMethod = options.verificationMethod
    const keyId = await publicKeyIdFromVerificationMethodId(this.agentContext, verificationMethod) // 1
    const signResult = await this.keyManagementApi.sign({
      keyId,
      algorithm: 'EdDSA',
      data: hashData,
    })
    const proofBytes = signResult.signature // 2
    if (proofBytes.length !== 64) {
      const err = `EdDSA signature must be exactly 64 bytes, got ${proofBytes.length}`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofGenerationError, err)
    } // 2
    return proofBytes // 3
  }

  /*
   * Spec: VC DI EdDSA v1.0 §§3.3.7
   * https://www.w3.org/TR/vc-di-eddsa/#proof-verification-eddsa-jcs-2022
   */
  public async proofVerification(
    hashData: Uint8Array,
    proofBytes: Uint8Array,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ) {
    const verificationMethod = options.verificationMethod
    const publicKeyBytes = await publicJwkFromVerificationMethodId(this.agentContext, verificationMethod) // 1
    const verificationResult = await this.keyManagementApi.verify({
      key: { publicJwk: publicKeyBytes.toJson() },
      algorithm: 'EdDSA',
      signature: proofBytes,
      data: hashData,
    }) // 2
    return verificationResult.verified // 3
  }

  private assertProofTypeAndCryptosuite(
    options: Partial<W3cDataIntegrityCryptosuiteProofOptions>,
    errorCode: W3cDataIntegrityProcessingErrorCode,
    caller: 'createProof' | 'verifyProof'
  ) {
    if (options.type !== 'DataIntegrityProof' || options.cryptosuite !== 'eddsa-jcs-2022') {
      const err = `Proof type must be 'DataIntegrityProof' AND cryptosuite must be 'eddsa-jcs-2022'`
      throw new W3cDataIntegrityProcessingError(errorCode, err)
    }
  }
}

function assertJcsInput(value: unknown, path = '$', seen = new WeakSet<object>()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    const err = `JCS canonicalization input contains unsupported value at ${path}`
    throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    const err = `JCS canonicalization input contains non-finite number at ${path}`
    throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertJcsInput(value[i], `${path}[${i}]`, seen)
    }
    return
  }

  if (isObject(value)) {
    const objectValue = value as object
    if (seen.has(objectValue)) {
      const err = `JCS canonicalization input contains circular reference at ${path}`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofTransformationError, err)
    }

    seen.add(objectValue)

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      assertJcsInput(nestedValue, `${path}.${key}`, seen)
    }
  }
}
