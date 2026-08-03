import * as core from 'webcrypto-core'
import { PublicJwk } from '../../../modules/kms'
import type { CredoWalletWebCrypto } from '../CredoWalletWebCrypto'
import { CredoWebCryptoKey } from '../CredoWebCryptoKey'
import type {
  CredoWebCryptoKeyPair,
  JsonWebKey,
  KeyFormat,
  KeyUsage,
  RsaHashedImportParams,
  RsaHashedKeyGenParams,
  RsaSsaParams,
} from '../types'

export class CredoRsaSsaProvider extends core.RsaSsaProvider {
  public constructor(private walletWebCrypto: CredoWalletWebCrypto) {
    super()
  }

  public async onSign(
    algorithm: RsaSsaParams & { name: 'RSASSA-PKCS1-v1_5' },
    key: CredoWebCryptoKey,
    data: ArrayBuffer
  ): Promise<ArrayBuffer> {
    return new Uint8Array(await this.walletWebCrypto.sign(key, new Uint8Array(data), algorithm)).buffer
  }

  public async onVerify(
    algorithm: RsaSsaParams & { name: 'RSASSA-PKCS1-v1_5' },
    key: CredoWebCryptoKey,
    signature: ArrayBuffer,
    data: ArrayBuffer
  ): Promise<boolean> {
    return this.walletWebCrypto.verify(key, algorithm, new Uint8Array(data), new Uint8Array(signature))
  }

  public async onGenerateKey(
    algorithm: RsaHashedKeyGenParams & { name: 'RSASSA-PKCS1-v1_5' },
    extractable: boolean,
    keyUsages: KeyUsage[]
  ): Promise<CredoWebCryptoKeyPair> {
    const key = await this.walletWebCrypto.generate(algorithm)
    const publicJwk = PublicJwk.fromPublicJwk(key.publicJwk)

    return {
      publicKey: new CredoWebCryptoKey(publicJwk, algorithm, extractable, 'public', keyUsages),
      privateKey: new CredoWebCryptoKey(publicJwk, algorithm, extractable, 'private', keyUsages),
    }
  }

  public async onExportKey(format: KeyFormat, key: CredoWebCryptoKey): Promise<JsonWebKey | ArrayBuffer> {
    const exported = await this.walletWebCrypto.exportKey(format, key)
    if (exported instanceof Uint8Array) return new Uint8Array(exported).buffer
    return exported
  }

  public async onImportKey(
    format: KeyFormat,
    keyData: JsonWebKey | ArrayBuffer,
    algorithm: RsaHashedImportParams & { name: 'RSASSA-PKCS1-v1_5' },
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
