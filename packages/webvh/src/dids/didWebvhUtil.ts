import { type AgentContext, Kms } from '@credo-ts/core'
import { AbstractCrypto, type SigningOutput } from 'didwebvh-ts'

export class DIDWebvhCrypto extends AbstractCrypto {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    super({
      verificationMethod: {
        id: 'did:webvh:123',
        controller: 'did:webvh:123',
        type: 'Ed25519VerificationKey2020',
        publicKeyMultibase: '123',
        secretKeyMultibase: '123',
      },
    })
    this.agentContext = agentContext
  }

  public async sign(): Promise<SigningOutput> {
    throw new Error('Not implemented')
  }

  private async isKmsAvailable(): Promise<boolean> {
    try {
      return !!(this.agentContext.dependencyManager.resolve(Kms.KeyManagementApi))
    } catch {
      return false
    }
  }

  private async verifyWithKms(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      const kms = this.agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

      const publicJwk = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: publicKey,
      })

      const verificationResult = await kms.verify({
        key: { publicJwk: publicJwk.toJson() },
        algorithm: 'EdDSA',
        signature: signature,
        data: message
      })

      return verificationResult.verified
    } catch (error) {
      this.agentContext.config.logger.error('KMS verification failed:', error)
      return false
    }
  }

  private async verifyWithLegacyMethod(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      // Fallback for older versions of Credo-TS without KMS
      // Use @stablelib/ed25519 for Ed25519 verification
      try {
        const { verify } = await import('@stablelib/ed25519')
        
        this.agentContext.config.logger.debug('Using @stablelib/ed25519 for signature verification')
        
        if (publicKey.length !== 32) {
          this.agentContext.config.logger.error(`Invalid public key length: expected 32 bytes, got ${publicKey.length}`)
          return false
        }
        
        if (signature.length !== 64) {
          this.agentContext.config.logger.error(`Invalid signature length: expected 64 bytes, got ${signature.length}`)
          return false
        }
        return verify(publicKey, message, signature)
      } catch (importError) {
        this.agentContext.config.logger.error('Failed to import @stablelib/ed25519:', importError)
        this.agentContext.config.logger.warn('No crypto utilities available for signature verification')
        return false
      }
    } catch (error) {
      this.agentContext.config.logger.error('Legacy verification failed:', error)
      return false
    }
  }

  public async verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      // Check if KMS is available in this version of Credo-TS
      const kmsAvailable = await this.isKmsAvailable()
      
      if (kmsAvailable) {
        this.agentContext.config.logger.debug('Using KMS for signature verification')
        return await this.verifyWithKms(signature, message, publicKey)
      } else {
        this.agentContext.config.logger.debug('KMS not available, using legacy verification method')
        return await this.verifyWithLegacyMethod(signature, message, publicKey)
      }
    } catch (error) {
      this.agentContext.config.logger.error('Error verifying signature:', error)
      return false
    }
  }
}
