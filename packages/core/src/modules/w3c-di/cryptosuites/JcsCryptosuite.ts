import type { AgentContext } from '../../../agent/context'
import { Hasher, type HashName } from '../../../crypto'
import { areObjectsEqual, asArray, MultiBaseEncoder, TypedArrayEncoder } from '../../../utils'
import { KeyManagementApi, type KnownJwaSignatureAlgorithm, type PublicJwk } from '../../kms'
import { isXsdDateTimeStamp } from '../proof-processing/iso8601Datetime'
import { canonicalizeJcsStrict } from '../proof-processing/jcs'
import { kmsPublicJwkFromVerificationMethodId, publicJwkFromVerificationMethodId } from '../proof-processing/keyUtils'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityUnsecuredDocument,
} from '../W3cDataIntegrityProof'
import type {
  W3cDataIntegrityCryptosuite,
  W3cDataIntegrityProofVerificationInput,
  W3cDataIntegrityProofVerificationResult,
} from './types'

export interface JcsCryptosuiteKeyParameters {
  hashName: Extract<HashName, 'sha-256' | 'sha-384'>
  signatureAlgorithm: KnownJwaSignatureAlgorithm
  signatureLength: number
}

/**
 * The processing shared by the JCS cryptosuites, `eddsa-jcs-2022` and `ecdsa-jcs-2019`. Their specs define the same
 * algorithms (section 3.3), so a cryptosuite only defines the keys it supports and the hash, signature algorithm and
 * signature length for a key.
 */
export abstract class JcsCryptosuite implements W3cDataIntegrityCryptosuite {
  public abstract readonly cryptosuite: string

  /**
   * The supported key types, as shown in errors.
   */
  protected abstract readonly supportedKeys: string

  private keyManagementApi: KeyManagementApi
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.keyManagementApi = agentContext.dependencyManager.resolve(KeyManagementApi)
  }

  /**
   * Returns the hash, signature algorithm and signature length for a key, or `undefined` if the key is not supported.
   */
  protected abstract getKeyParameters(publicJwk: PublicJwk): JcsCryptosuiteKeyParameters | undefined

  /*
   * Spec: section 3.3.1
   * https://www.w3.org/TR/vc-di-eddsa/#create-proof-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#create-proof-ecdsa-jcs-2019
   */
  public async createProof(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ): Promise<W3cDataIntegrityCryptosuiteProof> {
    this.assertProofTypeAndCryptosuite(options, W3cDataIntegrityProcessingErrorCode.ProofGenerationError)

    const proof: W3cDataIntegrityCryptosuiteProofOptions = { ...options } // 1

    if ('@context' in unsecuredDocument) {
      proof['@context'] = unsecuredDocument['@context']
    } // 2

    const proofConfig = this.proofConfiguration(proof) // 3
    const transformedDocument = this.transformation(unsecuredDocument, options) // 4

    // Resolved with its KMS key ID, so the DID document is only resolved once for hashing and signing.
    const publicJwk = await kmsPublicJwkFromVerificationMethodId(this.agentContext, options.verificationMethod)
    const hashData = this.hashing(transformedDocument, proofConfig, publicJwk) // 5
    const proofBytes = await this.proofSerialization(hashData, options, publicJwk) // 6
    const proofValue = MultiBaseEncoder.encode(proofBytes, 'base58btc') // 7

    return {
      ...proof,
      proofValue,
    } // 8
  }

  /*
   * Spec: section 3.3.2
   * https://www.w3.org/TR/vc-di-eddsa/#verify-proof-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#verify-proof-ecdsa-jcs-2019
   */
  public async verifyProof(
    input: W3cDataIntegrityProofVerificationInput
  ): Promise<W3cDataIntegrityProofVerificationResult> {
    const { unsecuredDocument: securedDocument, proof } = input
    const unsecuredDocument: W3cDataIntegrityUnsecuredDocument = { ...securedDocument } // 1
    const { proofValue, ...proofOptions } = proof // 2

    this.assertProofTypeAndCryptosuite(proofOptions, W3cDataIntegrityProcessingErrorCode.ProofVerificationError)

    const proofBytes = MultiBaseEncoder.decode(proofValue).data // 3

    if ('@context' in proofOptions) {
      // 4
      const proofContext = asArray(proofOptions['@context'])
      const documentContext = asArray(unsecuredDocument['@context'])

      // Compared by value, because an inline context object is a new object once the document is parsed.
      const hasMatchingContext =
        documentContext.length >= proofContext.length &&
        proofContext.every((value, index) => areObjectsEqual(documentContext[index], value)) // 4.1

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

    const publicJwk = await publicJwkFromVerificationMethodId(this.agentContext, proofOptions.verificationMethod)
    // Checked before hashing, which would otherwise reject the key with PROOF_GENERATION_ERROR.
    this.getSupportedKeyParameters(publicJwk, W3cDataIntegrityProcessingErrorCode.ProofVerificationError)
    const hashData = this.hashing(transformedDocument, proofConfig, publicJwk) // 7
    const verified = await this.proofVerification(hashData, proofBytes, proofOptions, publicJwk) // 8

    return {
      verified,
      verifiedDocument: verified ? unsecuredDocument : null,
    } // 9
  }

  /*
   * Spec: section 3.3.3
   * https://www.w3.org/TR/vc-di-eddsa/#transformation-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#transformation-ecdsa-jcs-2019
   */
  public transformation(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ) {
    this.assertProofTypeAndCryptosuite(options, W3cDataIntegrityProcessingErrorCode.ProofTransformationError) // 1

    const canonicalDocument = canonicalizeJcsStrict(unsecuredDocument) // 2
    return canonicalDocument // 3
  }

  /*
   * Spec: section 3.3.4
   * https://www.w3.org/TR/vc-di-eddsa/#hashing-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#hashing-ecdsa-jcs-2019
   *
   * The public key is passed as well, because ecdsa-jcs-2019 picks the hash from the key size.
   */
  public hashing(transformedDocument: string, canonicalProofConfig: string, publicJwk: PublicJwk) {
    const { hashName } = this.getSupportedKeyParameters(publicJwk)

    const transformedDocumentHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(transformedDocument), hashName) // 1
    const proofConfigHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(canonicalProofConfig), hashName) // 2

    const hashData = new Uint8Array(proofConfigHash.length + transformedDocumentHash.length) // 3
    hashData.set(proofConfigHash, 0)
    hashData.set(transformedDocumentHash, proofConfigHash.length)
    return hashData // 4
  }

  /*
   * Spec: section 3.3.5
   * https://www.w3.org/TR/vc-di-eddsa/#proof-configuration-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#proof-configuration-ecdsa-jcs-2019
   */
  public proofConfiguration(options: W3cDataIntegrityCryptosuiteProofOptions) {
    const proofConfig = { ...options } // 1

    this.assertProofTypeAndCryptosuite(proofConfig, W3cDataIntegrityProcessingErrorCode.ProofGenerationError) // 2

    if (typeof proofConfig.created === 'string' && !isXsdDateTimeStamp(proofConfig.created)) {
      const err = `Proof created must be a valid dateTimeStamp. Received '${proofConfig.created}'`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofGenerationError, err)
    } // 3

    const canonicalProofConfig = canonicalizeJcsStrict(proofConfig) // 4
    return canonicalProofConfig // 5
  }

  /*
   * Spec: section 3.3.6
   * https://www.w3.org/TR/vc-di-eddsa/#proof-serialization-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#proof-serialization-ecdsa-jcs-2019
   *
   * `publicJwk` is the key of `options.verificationMethod` with its KMS key ID set (step 1).
   */
  public async proofSerialization(
    hashData: Uint8Array,
    _options: W3cDataIntegrityCryptosuiteProofOptions,
    publicJwk: PublicJwk
  ) {
    const { signatureAlgorithm, signatureLength } = this.getSupportedKeyParameters(publicJwk)

    const { signature: proofBytes } = await this.keyManagementApi.sign({
      keyId: publicJwk.keyId,
      expectedPublicJwk: publicJwk.toJson(),
      algorithm: signatureAlgorithm,
      data: hashData,
    }) // 2

    // The KMS returns EdDSA and ECDSA signatures in their raw form (IEEE P1363 r || s for ECDSA), as the specs require.
    if (proofBytes.length !== signatureLength) {
      const err = `${signatureAlgorithm} signature must be exactly ${signatureLength} bytes, got ${proofBytes.length}`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofGenerationError, err)
    }

    return proofBytes // 3
  }

  /*
   * Spec: section 3.3.7
   * https://www.w3.org/TR/vc-di-eddsa/#proof-verification-eddsa-jcs-2022
   * https://www.w3.org/TR/vc-di-ecdsa/#proof-verification-ecdsa-jcs-2019
   *
   * `publicJwk` is the key retrieved from `options.verificationMethod` (step 1).
   */
  public async proofVerification(
    hashData: Uint8Array,
    proofBytes: Uint8Array,
    _options: W3cDataIntegrityCryptosuiteProofOptions,
    publicJwk: PublicJwk
  ) {
    const { signatureAlgorithm, signatureLength } = this.getSupportedKeyParameters(
      publicJwk,
      W3cDataIntegrityProcessingErrorCode.ProofVerificationError
    )

    // A signature of the wrong size can never be valid, and the KMS may throw on it instead of returning false.
    if (proofBytes.length !== signatureLength) return false

    const { verified } = await this.keyManagementApi.verify({
      key: { publicJwk: publicJwk.toJson() },
      algorithm: signatureAlgorithm,
      signature: proofBytes,
      data: hashData,
    }) // 2

    return verified // 3
  }

  private getSupportedKeyParameters(
    publicJwk: PublicJwk,
    errorCode = W3cDataIntegrityProcessingErrorCode.ProofGenerationError
  ): JcsCryptosuiteKeyParameters {
    const parameters = this.getKeyParameters(publicJwk)
    if (parameters) return parameters

    const err = `The '${this.cryptosuite}' cryptosuite only supports ${this.supportedKeys} keys, found ${publicJwk.jwkTypeHumanDescription}`
    throw new W3cDataIntegrityProcessingError(errorCode, err)
  }

  private assertProofTypeAndCryptosuite(
    options: Partial<W3cDataIntegrityCryptosuiteProofOptions>,
    errorCode: W3cDataIntegrityProcessingErrorCode
  ) {
    if (options.type !== 'DataIntegrityProof' || options.cryptosuite !== this.cryptosuite) {
      const err = `Proof type must be 'DataIntegrityProof' AND cryptosuite must be '${this.cryptosuite}'`
      throw new W3cDataIntegrityProcessingError(errorCode, err)
    }
  }
}
