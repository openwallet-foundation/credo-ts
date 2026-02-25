import { type AgentContext, type AnyUint8Array, Kms } from '@credo-ts/core'
import type { Verifier } from 'didwebvh-ts'

export class WebVhDidCrypto implements Verifier {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async verify(signature: AnyUint8Array, message: AnyUint8Array, publicKey: AnyUint8Array): Promise<boolean> {
    try {
      const kms = this.agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

      const publicJwk = Kms.PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey,
      })

      const verificationResult = await kms.verify({
        key: { publicJwk: publicJwk.toJson() },
        algorithm: 'EdDSA',
        signature: signature,
        data: message,
      })

      return verificationResult.verified
    } catch (error) {
      this.agentContext.config.logger.error('KMS verification failed:', error)
      return false
    }
  }
}
