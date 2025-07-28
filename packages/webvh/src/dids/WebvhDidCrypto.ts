import type { Verifier } from 'didwebvh-ts'

import { AskarWallet } from '@credo-ts/askar'
import { Buffer, type AgentContext, Key, KeyType, SigningProviderRegistry } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'

export class WebvhDidCrypto implements Verifier {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      const wallet = new AskarWallet(
        this.agentContext.config.logger,
        new agentDependencies.FileSystem(),
        new SigningProviderRegistry([])
      )
      const key = Key.fromPublicKey(publicKey, KeyType.Ed25519)
      const verificationResult = await wallet.verify({
        key,
        data: Buffer.from(message),
        signature: Buffer.from(signature),
      })

      return verificationResult
    } catch (error) {
      this.agentContext.config.logger.error('Wallet verification failed:', error)
      return false
    }
  }
}
