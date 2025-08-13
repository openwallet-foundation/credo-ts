import { type AgentContext, DidDocument } from '@credo-ts/core'
import {
  DidsApi,
  Hasher,
  Kms,
  MultiBaseEncoder,
  TypedArrayEncoder,
  getPublicJwkFromVerificationMethod,
} from '@credo-ts/core'
import { PublicJwk } from '@credo-ts/core/src/modules/kms'
import { canonicalize } from 'json-canonicalize'
import { WebVhResource } from '../anoncreds/utils/transform'
import { ProofOptions } from './types'

export class EddsaJcs2022Cryptosuite {
  agentContext: AgentContext
  proofOptions: object = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
  }
  constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async _logError(error: string) {
    this.agentContext.config.logger.error(error)
  }

  public async _publicJwkFromId(verificationMethodId: string): Promise<PublicJwk> {
    const didsApi = this.agentContext.dependencyManager.resolve(DidsApi)
    let didDocument = await didsApi.resolveDidDocument(verificationMethodId as string)
    didDocument = new DidDocument(didDocument)
    const verificationMethod = didDocument.dereferenceVerificationMethod(verificationMethodId)
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    return publicJwk
  }

  public transformation(unsecuredDocument: object, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#transformation-eddsa-jcs-2022
    if (options.type !== 'DataIntegrityProof') {
      this._logError('PROOF_VERIFICATION_ERROR')
      throw new Error('PROOF_VERIFICATION_ERROR')
    }
    if (options.cryptosuite !== 'eddsa-jcs-2022') {
      this._logError('PROOF_VERIFICATION_ERROR')
      throw new Error('PROOF_VERIFICATION_ERROR')
    }
    const canonicalDocument = canonicalize(unsecuredDocument)
    return canonicalDocument
  }

  public proofConfiguration(proofOptions: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#proof-configuration-eddsa-jcs-2022
    const proofConfig = Object.assign({}, proofOptions)
    if (proofConfig.type !== 'DataIntegrityProof') {
      this._logError('PROOF_GENERATION_ERROR')
      throw new Error('PROOF_GENERATION_ERROR')
    }
    if (proofConfig.cryptosuite !== 'eddsa-jcs-2022') {
      this._logError('PROOF_GENERATION_ERROR')
      throw new Error('PROOF_GENERATION_ERROR')
    }
    const canonicalProofConfig = canonicalize(proofConfig)
    return canonicalProofConfig
  }

  public hashing(transformedDocument: string, canonicalProofConfig: string) {
    // https://www.w3.org/TR/vc-di-eddsa/#hashing-eddsa-jcs-2022
    const transformedDocumentHash = Hasher.hash(TypedArrayEncoder.fromString(transformedDocument), 'sha-256')
    const proofConfigHash = Hasher.hash(TypedArrayEncoder.fromString(canonicalProofConfig), 'sha-256')
    const hashData = new Uint8Array(proofConfigHash.length + transformedDocumentHash.length)
    hashData.set(proofConfigHash, 0)
    hashData.set(transformedDocumentHash, proofConfigHash.length)
    return hashData
  }

  public async proofVerification(hashData: Uint8Array, proofBytes: Uint8Array, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#proof-verification-eddsa-jcs-2022
    const publicJwk = await this._publicJwkFromId(options.verificationMethod)
    const kms = this.agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const verificationResult = await kms.verify({
      key: { publicJwk: publicJwk.toJson() },
      algorithm: 'EdDSA',
      signature: proofBytes,
      data: hashData,
    })
    return verificationResult.verified
  }

  public async verifyProof(securedDocument: WebVhResource) {
    // https://www.w3.org/TR/vc-di-eddsa/#verify-proof-eddsa-jcs-2022
    const { proof, ...unsecuredDocument } = securedDocument
    const { proofValue, ...proofOptions } = securedDocument.proof
    const proofBytes = MultiBaseEncoder.decode(securedDocument.proof.proofValue)
    const transformedData = this.transformation(unsecuredDocument, proofOptions)
    const proofConfig = this.proofConfiguration(proofOptions)
    const hashData = this.hashing(transformedData, proofConfig)
    const verified = await this.proofVerification(hashData, proofBytes.data, proofOptions)
    const verificationResult = {
      verified,
      verifiedDocument: unsecuredDocument,
    }
    return verificationResult
  }
}
