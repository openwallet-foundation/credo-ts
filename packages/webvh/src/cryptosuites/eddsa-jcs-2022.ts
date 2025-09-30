import type { Proof, ProofOptions, UnsecuredDocument } from './types'
import type { WebVhResource } from '../anoncreds/utils/transform'

import {
  type AgentContext,
  Buffer,
  CredoError,
  DidsApi,
  Hasher,
  Key,
  MultiBaseEncoder,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { multibaseEncode, MultibaseEncoding } from 'didwebvh-ts'
import { canonicalize } from 'json-canonicalize'

import { WebvhDidCrypto } from '../dids'

export class EddsaJcs2022Cryptosuite {
  private didApi: DidsApi
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
    this.didApi = agentContext.dependencyManager.resolve(DidsApi)
  }

  private _logError(error: string) {
    this.agentContext.config.logger.error(error)
  }

  public async _publicKeyFromId(verificationMethodId: string): Promise<Key | null> {
    const didDocument = await this.didApi.resolveDidDocument(verificationMethodId)
    const verificationMethod = didDocument.dereferenceVerificationMethod(verificationMethodId)
    if ('publicKeyMultibase' in verificationMethod && verificationMethod.publicKeyMultibase) {
      return Key.fromFingerprint(verificationMethod.publicKeyMultibase)
    }
    return null
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
    const key = await this._publicKeyFromId(options.verificationMethod)
    if (!key) return false
    const crypto = new WebvhDidCrypto(this.agentContext)
    const verified = await crypto.verify(proofBytes, hashData, key.publicKey)
    return verified
  }

  public async verifyProof(securedDocument: WebVhResource) {
    // https://www.w3.org/TR/vc-di-eddsa/#verify-proof-eddsa-jcs-2022
    const unsecuredDocument = { ...securedDocument }
    delete (unsecuredDocument as { proof?: unknown }).proof
    const proofOptions = { ...securedDocument.proof } as ProofOptions
    delete (proofOptions as { proofValue?: unknown }).proofValue
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
    const key = await this._publicKeyFromId(options.verificationMethod)
    if (!key) {
      const err = `Could not resolve public key for verificationMethod "${options.verificationMethod}`
      this._logError(err)
      throw new CredoError(err)
    }
    const proofBytes = await this.agentContext.wallet.sign({
      key,
      data: Buffer.from(hashData),
    })
    return proofBytes
  }

  public async createProof(unsecuredDocument: UnsecuredDocument, options: ProofOptions) {
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
