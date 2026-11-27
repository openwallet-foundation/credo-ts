import type { AgentContext } from '../../../../agent/context'
import { Hasher } from '../../../../crypto'
import { areObjectsEqual, asArray, MultiBaseEncoder, TypedArrayEncoder } from '../../../../utils'
import { KeyManagementApi } from '../../../kms'
import { MlDsa44PublicJwk } from '../../../kms/jwk/kty/akp/MlDsa44PublicJwk'
import { isXsdDateTimeStamp } from '../../proof-processing/iso8601Datetime'
import { canonicalizeJcsStrict } from '../../proof-processing/jcs'
import {
  kmsPublicJwkFromVerificationMethodId,
  publicJwkFromVerificationMethodId,
} from '../../proof-processing/keyUtils'
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

const signatureLength = 2420

export class Mldsa44Jcs2024Cryptosuite implements W3cDataIntegrityCryptosuite {
  public readonly cryptosuite = 'mldsa44-jcs-2024'
  private keyManagementApi: KeyManagementApi
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.keyManagementApi = agentContext.dependencyManager.resolve(KeyManagementApi)
  }

  public async createProof(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ): Promise<W3cDataIntegrityCryptosuiteProof> {
    this.assertProofTypeAndCryptosuite(options, W3cDataIntegrityProcessingErrorCode.ProofGenerationError)

    const proof: W3cDataIntegrityCryptosuiteProofOptions = { ...options }
    if ('@context' in unsecuredDocument) proof['@context'] = unsecuredDocument['@context']

    const proofConfig = this.proofConfiguration(proof)
    const transformedDocument = this.transformation(unsecuredDocument, options)
    const hashData = this.hashing(transformedDocument, proofConfig)
    const proofBytes = await this.proofSerialization(hashData, options)

    return {
      ...proof,
      proofValue: MultiBaseEncoder.encode(proofBytes, 'base64url'),
    }
  }

  public async verifyProof(
    input: W3cDataIntegrityProofVerificationInput
  ): Promise<W3cDataIntegrityProofVerificationResult> {
    const { unsecuredDocument: securedDocument, proof } = input
    const unsecuredDocument: W3cDataIntegrityUnsecuredDocument = { ...securedDocument }
    const { proofValue, ...proofOptions } = proof
    this.assertProofTypeAndCryptosuite(proofOptions, W3cDataIntegrityProcessingErrorCode.ProofVerificationError)

    const decodedProof = MultiBaseEncoder.decode(proofValue)
    if (decodedProof.baseName !== 'base64url' || decodedProof.data.length !== signatureLength) {
      return { verified: false, verifiedDocument: null }
    }

    if ('@context' in proofOptions) {
      const proofContext = asArray(proofOptions['@context'])
      const documentContext = asArray(unsecuredDocument['@context'])
      const hasMatchingContext =
        documentContext.length >= proofContext.length &&
        proofContext.every((value, index) => areObjectsEqual(documentContext[index], value))

      if (!hasMatchingContext) return { verified: false, verifiedDocument: null }
      unsecuredDocument['@context'] = proofOptions['@context']
    }

    const transformedDocument = this.transformation(unsecuredDocument, proofOptions)
    const proofConfig = this.proofConfiguration(proofOptions)
    const hashData = this.hashing(transformedDocument, proofConfig)
    const verified = await this.proofVerification(hashData, decodedProof.data, proofOptions)

    return { verified, verifiedDocument: verified ? unsecuredDocument : null }
  }

  public transformation(
    unsecuredDocument: W3cDataIntegrityUnsecuredDocument,
    proofOptions: W3cDataIntegrityCryptosuiteProofOptions
  ) {
    this.assertProofTypeAndCryptosuite(proofOptions, W3cDataIntegrityProcessingErrorCode.ProofTransformationError)
    return canonicalizeJcsStrict(unsecuredDocument)
  }

  public hashing(transformedDocument: string, canonicalProofConfig: string) {
    const proofConfigHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(canonicalProofConfig), 'sha-256')
    const transformedDocumentHash = Hasher.hash(TypedArrayEncoder.fromUtf8String(transformedDocument), 'sha-256')
    const hashData = new Uint8Array(64)
    hashData.set(proofConfigHash, 0)
    hashData.set(transformedDocumentHash, 32)
    return hashData
  }

  public proofConfiguration(proofOptions: W3cDataIntegrityCryptosuiteProofOptions) {
    this.assertProofTypeAndCryptosuite(proofOptions, W3cDataIntegrityProcessingErrorCode.ProofGenerationError)

    if (typeof proofOptions.created === 'string' && !isXsdDateTimeStamp(proofOptions.created)) {
      throw new W3cDataIntegrityProcessingError(
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
        `Proof created must be a valid dateTimeStamp. Received '${proofOptions.created}'`
      )
    }

    return canonicalizeJcsStrict(proofOptions)
  }

  public async proofSerialization(hashData: Uint8Array, options: W3cDataIntegrityCryptosuiteProofOptions) {
    const publicJwk = await kmsPublicJwkFromVerificationMethodId(this.agentContext, options.verificationMethod)
    this.assertMldsa44Key(publicJwk, W3cDataIntegrityProcessingErrorCode.ProofGenerationError)
    const signResult = await this.keyManagementApi.sign({
      keyId: publicJwk.keyId,
      expectedPublicJwk: publicJwk.toJson(),
      algorithm: 'ML-DSA-44',
      data: hashData,
    })

    if (signResult.signature.length !== signatureLength) {
      throw new W3cDataIntegrityProcessingError(
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
        `ML-DSA-44 signature must be exactly ${signatureLength} bytes, got ${signResult.signature.length}`
      )
    }

    return signResult.signature
  }

  public async proofVerification(
    hashData: Uint8Array,
    proofBytes: Uint8Array,
    options: W3cDataIntegrityCryptosuiteProofOptions
  ) {
    if (proofBytes.length !== signatureLength) return false

    const publicJwk = await publicJwkFromVerificationMethodId(this.agentContext, options.verificationMethod)
    this.assertMldsa44Key(publicJwk, W3cDataIntegrityProcessingErrorCode.ProofVerificationError)
    const verificationResult = await this.keyManagementApi.verify({
      key: { publicJwk: publicJwk.toJson() },
      algorithm: 'ML-DSA-44',
      signature: proofBytes,
      data: hashData,
    })
    return verificationResult.verified
  }

  private assertProofTypeAndCryptosuite(
    options: Partial<W3cDataIntegrityCryptosuiteProofOptions>,
    errorCode: W3cDataIntegrityProcessingErrorCode
  ) {
    if (options.type !== 'DataIntegrityProof' || options.cryptosuite !== this.cryptosuite) {
      throw new W3cDataIntegrityProcessingError(
        errorCode,
        `Proof type must be 'DataIntegrityProof' AND cryptosuite must be '${this.cryptosuite}'`
      )
    }
  }

  private assertMldsa44Key(
    publicJwk: Awaited<ReturnType<typeof publicJwkFromVerificationMethodId>>,
    errorCode: W3cDataIntegrityProcessingErrorCode
  ) {
    if (!publicJwk.is(MlDsa44PublicJwk) || publicJwk.alg !== 'ML-DSA-44') {
      throw new W3cDataIntegrityProcessingError(errorCode, `The verification method must use an ML-DSA-44 public key`)
    }
  }
}
