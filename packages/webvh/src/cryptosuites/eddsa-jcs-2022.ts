
import type { AgentContext, VerificationMethod } from '@credo-ts/core'
import { DidsApi, MultiBaseEncoder } from '@credo-ts/core'
import { canonicalize } from 'json-canonicalize'
import { sha256 } from '@noble/hashes/sha256'
import { Key, KeyAlgorithm } from '@openwallet-foundation/askar-shared'

export class EddsaJcs2022Cryptosuite {
    agentContext: AgentContext
    proofOptions: object = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022'
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
    public transformation(unsecuredDocument: object, options: any) {
        // https://www.w3.org/TR/vc-di-eddsa/#transformation-eddsa-jcs-2022
        if (options.type !== 'DataIntegrityProof') {
            this._logError('PROOF_VERIFICATION_ERROR')
            throw new Error('PROOF_VERIFICATION_ERROR');
        }
        if (options.cryptosuite !== 'eddsa-jcs-2022') {
            this._logError('PROOF_VERIFICATION_ERROR')
            throw new Error('PROOF_VERIFICATION_ERROR');
        }
        let canonicalDocument = canonicalize(unsecuredDocument)
        return canonicalDocument
    }

    public proofConfiguration(proofOptions: any) {
        // https://www.w3.org/TR/vc-di-eddsa/#proof-configuration-eddsa-jcs-2022
        let proofConfig = Object.assign({}, proofOptions)
        if (proofConfig.type !== 'DataIntegrityProof') {
            this._logError('PROOF_GENERATION_ERROR')
            throw new Error('PROOF_GENERATION_ERROR');
        }
        if (proofConfig.cryptosuite !== 'eddsa-jcs-2022') {
            this._logError('PROOF_GENERATION_ERROR')
            throw new Error('PROOF_GENERATION_ERROR');
        }
        let canonicalProofConfig = canonicalize(proofConfig)
        return canonicalProofConfig
    }

    public hashing(transformedDocument: string, canonicalProofConfig: string) {
        // https://www.w3.org/TR/vc-di-eddsa/#hashing-eddsa-jcs-2022
        let transformedDocumentHash = sha256(transformedDocument)
        let proofConfigHash = sha256(canonicalProofConfig)
        let hashData = proofConfigHash + transformedDocumentHash
        return hashData
    }

    public async proofVerification(hashData: Uint8Array, proofBytes: Uint8Array, options: any) {
        // https://www.w3.org/TR/vc-di-eddsa/#proof-verification-eddsa-jcs-2022
        let publicKeyBytes = await this._publicBytesFromVerificationMethodId(options.verificationMethod)
        let key = Key.fromPublicBytes(
            {
                options: {
                    algorithm: KeyAlgorithm.Ed25519,
                    publicKey: publicKeyBytes
                }
            }
        )
        let verificationResult = key.verifySignature(
            {
                options: {
                    message: hashData,
                    signature: proofBytes,
                    sigType: 'EdDSA'
                }
            }
        )
        return verificationResult
    }

    public async verifyProof(securedDocument: any) {
        // https://www.w3.org/TR/vc-di-eddsa/#verify-proof-eddsa-jcs-2022
        let unsecuredDocument = (({ proof, ...unsecuredDocument }) => unsecuredDocument)(securedDocument);
        let proofOptions = (({ proofValue, ...proofOptions }) => proofOptions)(securedDocument.proof);
        let proofBytes = MultiBaseEncoder.decode(securedDocument.proof.proofValue);
        let transformedData = this.transformation(unsecuredDocument, proofOptions)
        let proofConfig = this.proofConfiguration(proofOptions)
        let hashData = this.hashing(transformedData, proofConfig)
        let verified = await this.proofVerification(hashData, proofBytes.data, proofOptions)
        let verificationResult = {
            verified,
            verifiedDocument: unsecuredDocument
        }
        return verificationResult
    }
}
