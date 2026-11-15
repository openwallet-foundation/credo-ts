import { Kms } from '@credo-ts/core'
import { PublicKey } from '@hashgraph/sdk'
import { Signer } from '@hiero-did-sdk/core'
import { createOrGetKey, hederaPublicKeyFromPublicJwk } from '../utils'

export class KmsSigner extends Signer {
  private _publicKey: PublicKey

  constructor(
    private readonly kms: Kms.KeyManagementApi,
    private publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  ) {
    super()

    this._publicKey = hederaPublicKeyFromPublicJwk(publicJwk)
  }

  async setKeyId(keyId: string): Promise<void> {
    this.publicJwk = await createOrGetKey(this.kms, keyId)
    this._publicKey = hederaPublicKeyFromPublicJwk(this.publicJwk)
  }

  publicKey(): Promise<string> {
    return Promise.resolve(this._publicKey.toStringDer())
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const { signature } = await this.kms.sign({
      keyId: this.publicJwk.keyId,
      backend: this.publicJwk.kmsBackend,
      expectedPublicJwk: this.publicJwk.toJson(),
      data,
      algorithm: 'EdDSA',
    })
    return signature
  }

  async verify(message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const { verified } = await this.kms.verify({
      data: message,
      signature,
      key: { keyId: this.publicJwk.keyId },
      backend: this.publicJwk.kmsBackend,
      algorithm: 'EdDSA',
    })
    return verified
  }
}
