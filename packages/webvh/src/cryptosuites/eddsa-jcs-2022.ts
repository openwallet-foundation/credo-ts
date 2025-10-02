import { type AgentContext, CredoError } from '@credo-ts/core'
import {
  Buffer,
  DidsApi,
  Hasher,
  Kms,
  MultiBaseEncoder,
  TypedArrayEncoder,
  getPublicJwkFromVerificationMethod,
} from '@credo-ts/core'
import { MultibaseEncoding, multibaseEncode } from 'didwebvh-ts'
import { canonicalize } from 'json-canonicalize'
import { WebVhResource } from '../anoncreds/utils/transform'
import type { Proof, ProofOptions, UnsecuredDocument } from './types'

export class EddsaJcs2022Cryptosuite {
  didApi: DidsApi
  keyApi: Kms.KeyManagementApi
  agentContext: AgentContext
  proofOptions: object = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
  }
  constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.didApi = agentContext.dependencyManager.resolve(DidsApi)
    this.keyApi = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
  }

  public async _logError(error: string) {
    this.agentContext.config.logger.error(error)
  }

  public async _publicJwkFromId(verificationMethodId: string): Promise<Kms.PublicJwk> {
    const didDocument = await this.didApi.resolveDidDocument(verificationMethodId)
    const [didRecord] = await this.didApi.getCreatedDids({ did: didDocument.id })
    const verificationMethod = didDocument.dereferenceVerificationMethod(verificationMethodId)
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
    if (didRecord) {
      publicJwk.keyId =
        didRecord.keys?.find(
          ({ didDocumentRelativeKeyId }) => didDocumentRelativeKeyId === `#${verificationMethod.publicKeyMultibase}`
        )?.kmsKeyId ?? publicJwk.legacyKeyId
    }
    return publicJwk
  }

  public transformation(unsecuredDocument: object, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#transformation-eddsa-jcs-2022
    if (options.type !== 'DataIntegrityProof') {
      const err = 'Proof type is not DataIntegrityProof'
      this._logError(err)
      throw new CredoError(err)
    }
    if (options.cryptosuite !== 'eddsa-jcs-2022') {
      const err = 'Cryptosuite is not eddsa-jcs-2022'
      this._logError(err)
      throw new CredoError(err)
    }
    const canonicalDocument = canonicalize(unsecuredDocument)
    return canonicalDocument
  }

  public proofConfiguration(proofOptions: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#proof-configuration-eddsa-jcs-2022
    const proofConfig = Object.assign({}, proofOptions)
    if (proofConfig.type !== 'DataIntegrityProof') {
      const err = 'Proof type is not DataIntegrityProof'
      this._logError(err)
      throw new CredoError(err)
    }
    if (proofConfig.cryptosuite !== 'eddsa-jcs-2022') {
      const err = 'Cryptosuite is not eddsa-jcs-2022'
      this._logError(err)
      throw new CredoError(err)
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
    const verificationResult = await this.keyApi.verify({
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
  public async proofSerialization(hashData: Uint8Array, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#proof-serialization-eddsa-jcs-2022
    const publicJwk = await this._publicJwkFromId(options.verificationMethod)
    const proofBytes = await this.keyApi.sign({
      keyId: publicJwk.keyId,
      algorithm: 'EdDSA',
      data: Buffer.from(hashData),
    })
    return proofBytes.signature
  }

  async createProof(unsecuredDocument: UnsecuredDocument, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#create-proof-eddsa-jcs-2022
    const proof: Proof = {
      ...options,
      proofValue: '',
    }
    const proofConfig = this.proofConfiguration(options)
    const transformedData = this.transformation(unsecuredDocument, options)
    const hashData = this.hashing(transformedData, proofConfig)
    const proofBytes = await this.proofSerialization(hashData, options)
    proof.proofValue = multibaseEncode(proofBytes, MultibaseEncoding.BASE58_BTC)
    return proof
  }
}
