import { type AgentContext, Buffer, Kms } from '@credo-ts/core'
import {
  MultibaseEncoding,
  Signer,
  SigningInput,
  SigningOutput,
  multibaseDecode,
  multibaseEncode,
  prepareDataForSigning,
} from 'didwebvh-ts'

/**
 * Complement to the WebvhDidCrypto class implementing the Signer interface.
 * Provides cryptographic operations for DID documents using Ed25519 keys.
 */
export class WebvhDidCryptoSigner implements Signer {
  private publicKeyMultibase: string
  private agentContext: AgentContext
  public readonly supportedMethods: string[] = ['webvh']

  /**
   * Constructs a new instance of WebvhDidCryptoSigner.
   * @param agentContext - The agent context containing wallet and configuration.
   * @param publicKeyMultibase - The public key encoded in multibase format.
   */
  constructor(agentContext: AgentContext, publicKeyMultibase: string) {
    this.agentContext = agentContext
    this.publicKeyMultibase = publicKeyMultibase
  }

  /**
   * Gets the verification method identifier in DID:key format.
   * @returns The DID:key identifier as a string.
   */
  getVerificationMethodId(): string {
    return `did:key:${this.publicKeyMultibase}`
  }

  /**
   * Signs the provided input document using the Ed25519 secret key.
   * @param input - The signing input containing the document and proof.
   * @returns A promise that resolves to the signing output with the proof value.
   * @throws Error if the secret key is not found or signing fails.
   */
  async sign(input: SigningInput): Promise<SigningOutput> {
    try {
      const decoded = multibaseDecode(this.publicKeyMultibase).bytes
      const data = await prepareDataForSigning(input.document, input.proof)
      const kms = this.agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

      const publicJwk = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: Buffer.from(decoded.slice(2).slice(0, 32)),
      })
      const signature = await kms.sign({
        keyId: publicJwk.keyId,
        algorithm: 'EdDSA',
        data: Buffer.from(data),
      })
      return {
        proofValue: multibaseEncode(signature.signature, MultibaseEncoding.BASE58_BTC),
      }
    } catch (error) {
      this.agentContext.config.logger.error('KMS signing error:', error)
      throw error
    }
  }
}
