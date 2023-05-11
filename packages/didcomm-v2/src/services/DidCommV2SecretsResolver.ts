import type { Secret, SecretsResolver } from 'didcomm'

import { InjectionSymbols, Wallet, inject, injectable, Key, getKeyDidMappingByKeyType } from '@aries-framework/core'

@injectable()
export class DidCommV2SecretsResolver implements SecretsResolver {
  private wallet: Wallet

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet) {
    this.wallet = wallet
  }

  public async find_secrets(secret_ids: Array<string>): Promise<Array<string>> {
    const secrets = []
    for (const secret_id of secret_ids) {
      // Workaround: AFJ core stores keys in the Wallet by their base58 representation, so we need to parse kid to get it
      const keyId = Key.fromPublicKeyId(secret_id).publicKeyBase58
      const secret = await this.wallet.retrieveKeyPair(keyId)
      if (secret) {
        secrets.push(secret_id)
      }
    }
    return secrets
  }

  public async get_secret(secret_id: string): Promise<Secret | null> {
    // Workaround: AFJ core stores keys in the Wallet by their base58 representation, so we need to parse kid to get it
    const keyId = Key.fromPublicKeyId(secret_id).publicKeyBase58
    const key = await this.wallet.retrieveKeyPair(keyId)
    if (!key) return null

    const { supportedVerificationMethodTypes } = getKeyDidMappingByKeyType(key.keyType)
    return {
      id: secret_id,
      type: supportedVerificationMethodTypes[0],
      privateKeyBase58: key.privateKeyBase58,
    }
  }
}
