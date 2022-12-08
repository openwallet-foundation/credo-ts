import type { Secret, SecretsResolver } from 'didcomm'

import { InjectionSymbols, Wallet, inject, injectable, getKeyDidMappingByKeyType, Key } from '@aries-framework/core'

@injectable()
export class DidCommV2SecretsResolver implements SecretsResolver {
  private wallet: Wallet

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet) {
    this.wallet = wallet
  }

  public async find_secrets(secret_ids: Array<string>): Promise<Array<string>> {
    const secrets = []
    for (const secret_id of secret_ids) {
      const secret = await this.wallet.retrieveKeyPair(Key.fromKeyId(secret_id).publicKeyBase58)
      if (secret) {
        secrets.push(secret_id)
      }
    }
    return secrets
  }

  public async get_secret(secret_id: string): Promise<Secret | null> {
    const key = await this.wallet.retrieveKeyPair(Key.fromKeyId(secret_id).publicKeyBase58)
    if (!key) return null

    const { supportedVerificationMethodTypes } = getKeyDidMappingByKeyType(key.keyType)
    return {
      id: secret_id,
      type: supportedVerificationMethodTypes[0],
      secret_material: { format: 'Base58', value: key.privateKeyBase58 },
    }
  }
}
