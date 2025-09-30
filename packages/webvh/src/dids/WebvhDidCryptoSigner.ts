import { type AgentContext, Buffer, Key } from '@credo-ts/core'
import {
  MultibaseEncoding,
  type Signer,
  type SigningInput,
  type SigningOutput,
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
  public constructor(agentContext: AgentContext, publicKeyMultibase: string) {
    this.agentContext = agentContext
    this.publicKeyMultibase = publicKeyMultibase
  }

  /**
   * Gets the verification method identifier in DID:key format.
   * @returns The DID:key identifier as a string.
   */
  public getVerificationMethodId(): string {
    return `did:key:${this.publicKeyMultibase}`
  }

  /**
   * Signs the provided input document using the Ed25519 secret key.
   * @param input - The signing input containing the document and proof.
   * @returns A promise that resolves to the signing output with the proof value.
   * @throws Error if the secret key is not found or signing fails.
   */
  public async sign(input: SigningInput): Promise<SigningOutput> {
    try {
      const key = Key.fromFingerprint(this.publicKeyMultibase)
      const data = await prepareDataForSigning(input.document, input.proof)
      const signature = await this.agentContext.wallet.sign({
        key,
        data: Buffer.from(data),
      })
      return {
        proofValue: multibaseEncode(signature, MultibaseEncoding.BASE58_BTC),
      }
    } catch (error) {
      this.agentContext.config.logger.error('Ed25519 signing error:', error)
      throw error
    }
  }
}
