import { type AgentContext, type VerificationMethod, Kms } from '@credo-ts/core'
import { DidsApi, MultiBaseEncoder } from '@credo-ts/core'
import { sha256 } from '@noble/hashes/sha256'
import { createPublicKey, verify } from "crypto";
import { canonicalize } from 'json-canonicalize'
import { ProofOptions } from './types'
import { WebVhResource } from '../anoncreds/utils/transform'

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

  public async _publicBytesFromVerificationMethodId(verificationMethodId: string) {
    const didsApi = this.agentContext.dependencyManager.resolve(DidsApi)
    const didDocument = await didsApi.resolveDidDocument(verificationMethodId as string)

    let verificationMethod: VerificationMethod | undefined
    if ((verificationMethodId as string).includes('#')) {
      const fragment = (verificationMethodId as string).split('#')[1]
      verificationMethod = didDocument.verificationMethod?.find((vm: VerificationMethod) =>
        vm.id.endsWith(`#${fragment}`)
      )
    }

    if (!verificationMethod) {
      this._logError('Could not find verification method in did:webvh DID document')
      return
    }

    if ('publicKeyMultibase' in verificationMethod && verificationMethod.publicKeyMultibase) {
      const publicKeyBytes = this._publicKeyBytesFromMultikey(verificationMethod.publicKeyMultibase)
      return publicKeyBytes
    } else {
      this._logError('Could not find verification method in did:webvh DID document')
      return
    }
  }

  public _publicKeyBytesFromMultikey(multikey: string) {
    const publicMultikeyBytes = MultiBaseEncoder.decode(multikey).data
    const publicMultikeyHex = Array.from(publicMultikeyBytes).map(n => n.toString(16).padStart(2, "0")).join("");
    const publicKeyHex = publicMultikeyHex.substring(4)
    const publicKeyLength = publicKeyHex.length / 2;
    const publicKeyBytes = new Uint8Array(publicKeyLength);
    for (var i=0; i<publicKeyLength; i++) {
        publicKeyBytes[i] = parseInt(publicKeyHex.substr(i*2, 2), 16);
    }
    return publicKeyBytes;
  }

  public _keyFromPublicBytes(publicKeyBytes: Uint8Array) {
    const publicKey = createPublicKey({
      key: Buffer.concat([
        Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]),
        Buffer.from(publicKeyBytes)
      ]),
      format: "der",
      type: "spki",
    });
    return publicKey
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
    const encoder = new TextEncoder()
    const transformedDocumentHash = sha256(encoder.encode(transformedDocument))
    const proofConfigHash = sha256(encoder.encode(canonicalProofConfig))
    const hashData = new Uint8Array(proofConfigHash.length + transformedDocumentHash.length);
    hashData.set(proofConfigHash, 0);
    hashData.set(transformedDocumentHash, proofConfigHash.length);
    return hashData
  }

  public async proofVerification(hashData: Uint8Array, proofBytes: Uint8Array, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#proof-verification-eddsa-jcs-2022
    const publicKeyBytes = await this._publicBytesFromVerificationMethodId(options.verificationMethod)
    const publicKey = this._keyFromPublicBytes(publicKeyBytes)
    const verified = verify(null, hashData, publicKey, proofBytes)
    return verified
  }

  public async verifyProof(securedDocument: WebVhResource) {
    // https://www.w3.org/TR/vc-di-eddsa/#verify-proof-eddsa-jcs-2022
    const unsecuredDocument = (({ proof, ...unsecuredDocument }) => unsecuredDocument)(securedDocument)
    const proofOptions = (({ proofValue, ...proofOptions }) => proofOptions)(securedDocument.proof)
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
