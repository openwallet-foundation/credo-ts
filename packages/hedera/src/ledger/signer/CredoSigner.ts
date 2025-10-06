import type { AgentContext, Key } from '@credo-ts/core'
import type { PublicKey } from '@hashgraph/sdk'

import { Buffer } from '@credo-ts/core'
import { Signer } from '@hiero-did-sdk/core'

import { hederaPublicKeyFromCredoKey } from '../utils'

export class CredoSigner extends Signer {
  private _publicKey: PublicKey

  public constructor(private readonly agentContext: AgentContext, private key: Key) {
    super()

    this._publicKey = hederaPublicKeyFromCredoKey(key)
  }

  public async setKey(key: Key): Promise<void> {
    this.key = key
    this._publicKey = hederaPublicKeyFromCredoKey(key)
  }

  public publicKey(): Promise<string> {
    return Promise.resolve(this._publicKey.toStringDer())
  }

  public async sign(data: Uint8Array): Promise<Uint8Array> {
    return this.agentContext.wallet.sign({
      key: this.key,
      data: Buffer.from(data),
    })
  }

  public async verify(message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return this.agentContext.wallet.verify({
      data: Buffer.from(message),
      signature: Buffer.from(signature),
      key: this.key,
    })
  }
}
