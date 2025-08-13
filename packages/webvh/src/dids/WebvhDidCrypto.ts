import { type AgentContext, Kms } from '@credo-ts/core'
import { Verifier } from 'didwebvh-ts'

export class WebvhDidCrypto implements Verifier {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
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
        data: message,
      })
      console.log(verificationResult)

      return verificationResult.verified
    } catch (error) {
      this.agentContext.config.logger.error('KMS verification failed:', error)
      return false
    }
  }
}
