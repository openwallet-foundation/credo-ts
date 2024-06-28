import type { CredoWalletWebCrypto } from '../CredoWalletWebCrypto'
import type {
  CredoWebCryptoKeyPair,
  Ed25519KeyGenParams,
  Ed25519KeyImportParams,
  Ed25519Params,
  JsonWebKey,
  KeyFormat,
  KeyUsage,
} from '../types'

import * as core from 'webcrypto-core'

import { CredoWebCryptoKey } from '../CredoWebCryptoKey'

export class CredoEd25519Provider extends core.Ed25519Provider {
  public constructor(private walletWebCrypto: CredoWalletWebCrypto) {
    super()
  }

  public async onSign(algorithm: Ed25519Params, key: CredoWebCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return this.walletWebCrypto.sign(key, new Uint8Array(data), algorithm)
  }

  public async onVerify(
    algorithm: Ed25519Params,
    key: CredoWebCryptoKey,
    signature: ArrayBuffer,
    data: ArrayBuffer
  ): Promise<boolean> {
    return this.walletWebCrypto.verify(key, algorithm, new Uint8Array(data), new Uint8Array(signature))
  }

  public async onGenerateKey(
    algorithm: Ed25519KeyGenParams,
    extractable: boolean,
    keyUsages: KeyUsage[]
  ): Promise<CredoWebCryptoKeyPair> {
    const key = await this.walletWebCrypto.generate(algorithm)

    return {
      publicKey: new CredoWebCryptoKey(key, algorithm, extractable, 'public', keyUsages),
      privateKey: new CredoWebCryptoKey(key, algorithm, extractable, 'private', keyUsages),
    }
  }

  public async onExportKey(format: KeyFormat, key: CredoWebCryptoKey): Promise<JsonWebKey | ArrayBuffer> {
    return this.walletWebCrypto.exportKey(format, key)
  }

  public async onImportKey(
    format: KeyFormat,
    keyData: JsonWebKey | ArrayBuffer,
    algorithm: Ed25519KeyImportParams,
    extractable: boolean,
    keyUsages: KeyUsage[]
  ): Promise<CredoWebCryptoKey> {
    return this.walletWebCrypto.importKey(
      format,
      (keyData as JsonWebKey).kty ? (keyData as JsonWebKey) : new Uint8Array(keyData as ArrayBuffer),
      algorithm,
      extractable,
      keyUsages
    )
  }
}
