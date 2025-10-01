import { PublicKey } from '@hashgraph/sdk'
import { Signer } from '@hiero-did-sdk/core'
import { hederaPublicKeyFromCredoKey } from '../utils'
import { AgentContext, Key, Buffer } from '@credo-ts/core'

export class CredoSigner extends Signer {
  private _publicKey: PublicKey

  constructor(
    private readonly agentContext: AgentContext,
    private key: Key
  ) {
    super()

    this._publicKey = hederaPublicKeyFromCredoKey(key)
  }

  async setKey(key: Key): Promise<void> {
    this.key = key
    this._publicKey = hederaPublicKeyFromCredoKey(key)
  }

  publicKey(): Promise<string> {
    return Promise.resolve(this._publicKey.toStringDer())
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    return this.agentContext.wallet.sign({
      key: this.key,
      data: Buffer.from(data),
    })
  }

  async verify(message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return this.agentContext.wallet.verify({
      data: Buffer.from(message),
      signature: Buffer.from(signature),
      key: this.key,
    })
  }
}
