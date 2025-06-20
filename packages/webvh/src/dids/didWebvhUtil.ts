import { type AgentContext, Buffer, Kms, TypedArrayEncoder } from '@credo-ts/core'
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

  public async verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      if (!this.agentContext) {
        throw new Error('Agent context is required')
      }

      // Use the JWK + KMS approach like in WebVhAnonCredsRegistry
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
      // Log error in a non-production environment
      if (process.env.NODE_ENV !== 'production') {
        this.agentContext.config.logger.error('Error verifying signature:', error)
      }
      return false
    }
  }
}

export interface IDidDocOptions {
  verificationMethods: {
    publicKeyMultibase: string
    privateKeyMultibase?: string
  }[]
  updateKeys: string[]
  baseUrl: string
}
