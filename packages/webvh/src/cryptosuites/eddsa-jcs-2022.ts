import type { AgentContext, VerificationMethod } from '@credo-ts/core'
import { DidsApi, MultiBaseEncoder } from '@credo-ts/core'
import { sha256 } from '@noble/hashes/sha256'
import { Key, KeyAlgorithm } from '@openwallet-foundation/askar-shared'
import { canonicalize } from 'json-canonicalize'
import { ProofOptions, SecuredDocument } from './types'

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

    let publicKeyBytes: Uint8Array
    if ('publicKeyMultibase' in verificationMethod && verificationMethod.publicKeyMultibase) {
      const publicKeyBuffer = MultiBaseEncoder.decode(verificationMethod.publicKeyMultibase)
      publicKeyBytes = publicKeyBuffer.data
    } else {
      this._logError('Could not find verification method in did:webvh DID document')
      return
    }
    return publicKeyBytes
  }

  public _keyFromPublicBytes(publicKeyBytes: Uint8Array) {
    // https://www.w3.org/TR/vc-di-eddsa/#hashing-eddsa-jcs-2022
    return Key.fromPublicBytes({ options: { algorithm: 'Ed25519', publicKey: publicKeyBytes } })
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
    const transformedDocumentHash = sha256(transformedDocument)
    const proofConfigHash = sha256(canonicalProofConfig)
    const hashData = proofConfigHash + transformedDocumentHash
    return hashData
  }

  public async proofVerification(hashData: Uint8Array, proofBytes: Uint8Array, options: ProofOptions) {
    // https://www.w3.org/TR/vc-di-eddsa/#proof-verification-eddsa-jcs-2022
    const publicKeyBytes = await this._publicBytesFromVerificationMethodId(options.verificationMethod)
    const key = Key.fromPublicBytes({
      options: {
        algorithm: KeyAlgorithm.Ed25519,
        publicKey: publicKeyBytes,
      },
    })
    const verificationResult = key.verifySignature({
      options: {
        message: hashData,
        signature: proofBytes,
        sigType: 'EdDSA',
      },
    })
    return verificationResult
  }

  public async verifyProof(securedDocument: SecuredDocument) {
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
