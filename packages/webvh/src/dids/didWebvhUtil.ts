import { type AgentContext, Buffer, KeyType, Key } from '@credo-ts/core'
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

      const key = new Key(publicKey, KeyType.Ed25519)

      return await this.agentContext.wallet.verify({
        key,
        data: Buffer.from(message),
        signature: Buffer.from(signature),
      })
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
