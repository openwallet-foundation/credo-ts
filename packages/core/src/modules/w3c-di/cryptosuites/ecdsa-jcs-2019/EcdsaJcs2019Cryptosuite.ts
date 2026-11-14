import type { AgentContext } from '../../../../agent/context'
import { Hasher } from '../../../../crypto'
import { MultiBaseEncoder, TypedArrayEncoder } from '../../../../utils'
import { KeyManagementApi, P256PublicJwk, P384PublicJwk, type PublicJwk } from '../../../kms'
import { isXsdDateTimeStamp } from '../../proof-processing/iso8601Datetime'
import { canonicalizeJcsStrict } from '../../proof-processing/jcs'
import {
  kmsPublicJwkFromVerificationMethodId,
  publicJwkFromVerificationMethodId,
} from '../../proof-processing/keyUtils'
import { documentContextStartsWithProofContext } from '../../proof-processing/proofContext'
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

interface EcdsaCurveParameters {
  hashName: 'sha-256' | 'sha-384'
  signatureAlgorithm: 'ES256' | 'ES384'
  signatureLength: number
}

const P256_PARAMETERS: EcdsaCurveParameters = { hashName: 'sha-256', signatureAlgorithm: 'ES256', signatureLength: 64 }
const P384_PARAMETERS: EcdsaCurveParameters = { hashName: 'sha-384', signatureAlgorithm: 'ES384', signatureLength: 96 }

/**
 * The `ecdsa-jcs-2019` cryptosuite from VC Data Integrity ECDSA Cryptosuites v1.0, for P-256 and P-384 keys.
 *
 * The curve of the verification method key selects the hash (SHA-256 or SHA-384), the ECDSA signature
 * algorithm and the expected signature length, so the key is resolved before hashing.
 */
export class EcdsaJcs2019Cryptosuite implements W3cDataIntegrityCryptosuite {
  public readonly cryptosuite = 'ecdsa-jcs-2019'
  private keyManagementApi: KeyManagementApi
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.keyManagementApi = agentContext.dependencyManager.resolve(KeyManagementApi)
  }

  /*
   * Spec: VC DI ECDSA v1.0 section 3.3.1
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
    const transformedData = this.transformation(unsecuredDocument, options) // 4

    // Resolved with its KMS key ID, so the DID document is only resolved once for hashing and signing.
    const publicJwk = await kmsPublicJwkFromVerificationMethodId(this.agentContext, options.verificationMethod)
    const hashData = this.hashing(transformedData, proofConfig, publicJwk) // 5
    const proofBytes = await this.proofSerialization(hashData, options, publicJwk) // 6
    const proofValue = MultiBaseEncoder.encode(proofBytes, 'base58btc') // 7

    return {
      ...proof,
      proofValue,
    } // 8
  }

  /*
   * Spec: VC DI ECDSA v1.0 section 3.3.2
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
      if (!documentContextStartsWithProofContext(unsecuredDocument['@context'], proofOptions['@context'])) {
        return {
          verified: false,
          verifiedDocument: null,
        } // 4.1
      }

      unsecuredDocument['@context'] = proofOptions['@context'] // 4.2
    }

    const transformedData = this.transformation(unsecuredDocument, proofOptions) // 5
    const proofConfig = this.proofConfiguration(proofOptions) // 6

    const publicJwk = await publicJwkFromVerificationMethodId(this.agentContext, proofOptions.verificationMethod)
    getCurveParameters(publicJwk, W3cDataIntegrityProcessingErrorCode.ProofVerificationError)
    const hashData = this.hashing(transformedData, proofConfig, publicJwk) // 7
    const verified = await this.proofVerification(hashData, proofBytes, proofOptions, publicJwk) // 8

    return {
      verified,
      verifiedDocument: verified ? unsecuredDocument : null,
    } // 9
  }

  /*
   * Spec: VC DI ECDSA v1.0 section 3.3.3
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
   * Spec: VC DI ECDSA v1.0 section 3.3.4
   * https://www.w3.org/TR/vc-di-ecdsa/#hashing-ecdsa-jcs-2019
   *
   * The spec inputs are the transformed document and the canonical proof configuration. The public key
   * is passed as well, because its curve selects SHA-256 (P-256) or SHA-384 (P-384).
   */
  public hashing(transformedDocument: string, canonicalProofConfig: string, publicJwk: PublicJwk) {
    const { hashName } = getCurveParameters(publicJwk)

    const transformedDocumentHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(transformedDocument), hashName) // 1
    const proofConfigHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(canonicalProofConfig), hashName) // 2

    const hashData = new Uint8Array(proofConfigHash.length + transformedDocumentHash.length) // 3
    hashData.set(proofConfigHash, 0)
    hashData.set(transformedDocumentHash, proofConfigHash.length)
    return hashData // 4
  }

  /*
   * Spec: VC DI ECDSA v1.0 section 3.3.5
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
   * Spec: VC DI ECDSA v1.0 section 3.3.6
   * https://www.w3.org/TR/vc-di-ecdsa/#proof-serialization-ecdsa-jcs-2019
   *
   * `publicJwk` is the key of `options.verificationMethod` with its KMS key ID set (step 1). Its curve selects ES256
   * or ES384 and the expected signature length.
   */
  public async proofSerialization(
    hashData: Uint8Array,
    _options: W3cDataIntegrityCryptosuiteProofOptions,
    publicJwk: PublicJwk
  ) {
    const { signatureAlgorithm, signatureLength } = getCurveParameters(publicJwk)

    const { signature: proofBytes } = await this.keyManagementApi.sign({
      keyId: publicJwk.keyId,
      expectedPublicJwk: publicJwk.toJson(),
      algorithm: signatureAlgorithm,
      data: hashData,
    }) // 2

    // The KMS returns ECDSA signatures in IEEE P1363 form (r || s), as required by the spec.
    if (proofBytes.length !== signatureLength) {
      const err = `${signatureAlgorithm} signature must be exactly ${signatureLength} bytes, got ${proofBytes.length}`
      throw new W3cDataIntegrityProcessingError(W3cDataIntegrityProcessingErrorCode.ProofGenerationError, err)
    }

    return proofBytes // 3
  }

  /*
   * Spec: VC DI ECDSA v1.0 section 3.3.7
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
    const { signatureAlgorithm, signatureLength } = getCurveParameters(
      publicJwk,
      W3cDataIntegrityProcessingErrorCode.ProofVerificationError
    )

    // A signature of the wrong size can never be valid for this curve.
    if (proofBytes.length !== signatureLength) return false

    const { verified } = await this.keyManagementApi.verify({
      key: { publicJwk: publicJwk.toJson() },
      algorithm: signatureAlgorithm,
      signature: proofBytes,
      data: hashData,
    }) // 2

    return verified // 3
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

function getCurveParameters(
  publicJwk: PublicJwk,
  errorCode = W3cDataIntegrityProcessingErrorCode.ProofGenerationError
): EcdsaCurveParameters {
  if (publicJwk.is(P256PublicJwk)) return P256_PARAMETERS
  if (publicJwk.is(P384PublicJwk)) return P384_PARAMETERS

  const err = `The 'ecdsa-jcs-2019' cryptosuite only supports P-256 and P-384 keys, found ${publicJwk.jwkTypeHumanDescription}`
  throw new W3cDataIntegrityProcessingError(errorCode, err)
}
