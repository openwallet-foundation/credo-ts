import type { Secret, SecretsResolver } from 'didcomm'

import { InjectionSymbols } from '../../../constants'
import { KeyType } from '../../../crypto'
import { inject, injectable } from '../../../plugins'
import { Wallet } from '../../../wallet/Wallet'

export enum KeyFormat {
  Base58 = 'Base58',
  Base64 = 'Base64',
  JWK = 'JWK',
  Multibase = 'Multibase',
  Hex = 'Hex',
  Pem = 'Pem',
  BlockchainAccountId = 'BlockchainAccountId',
  EthereumAddress = 'EthereumAddress',
}

const keyTypesMapping = {
  [KeyType.Ed25519]: 'Ed25519VerificationKey2018',
  [KeyType.X25519]: 'X25519KeyAgreementKey2019',
  [KeyType.Bls12381g1g2]: 'Bls12381G1G2Key2020',
  [KeyType.Bls12381g1]: 'Bls12381G1Key2020',
  [KeyType.Bls12381g2]: 'Bls12381G2Key2020',
}

@injectable()
export class SecretResolverService implements SecretsResolver {
  private wallet: Wallet

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet) {
    this.wallet = wallet
  }

  public async find_secrets(secret_ids: Array<string>): Promise<Array<string>> {
    const secrets = []
    for (const secret_id of secret_ids) {
      const secret = await this.wallet.retrieveKeyPair(secret_id)
      if (secret) {
        secrets.push(secret_id)
      }
    }
    return secrets
  }

  public async get_secret(secret_id: string): Promise<Secret | null> {
    const key = await this.wallet.retrieveKeyPair(secret_id)
    if (!key) return null
    return {
      id: secret_id,
      type: keyTypesMapping[key.keyType],
      secret_material: { format: KeyFormat.Base58, value: key.privateKeyBase58 },
    }
  }
}
