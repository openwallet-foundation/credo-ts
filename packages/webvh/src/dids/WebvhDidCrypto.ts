import type { Verifier } from 'didwebvh-ts'

import { Buffer, type AgentContext, Key, KeyType } from '@credo-ts/core'

export class WebvhDidCrypto implements Verifier {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    try {
      const key = Key.fromPublicKey(publicKey, KeyType.Ed25519)
      const verificationResult = await this.agentContext.wallet.verify({
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
