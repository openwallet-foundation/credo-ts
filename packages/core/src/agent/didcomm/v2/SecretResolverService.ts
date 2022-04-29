import type { Secret, SecretsResolver } from 'didcomm-node'

import { scoped, Lifecycle } from 'tsyringe'

import { KeyType } from '../../../crypto'
import { KeyService } from '../../../modules/keys'

const keyTypesMapping = {
  [KeyType.Ed25519]: 'Ed25519VerificationKey2018',
  [KeyType.X25519]: 'X25519KeyAgreementKey2019',
  [KeyType.Secp256k1]: 'EcdsaSecp256k1VerificationKey2019',
  [KeyType.Bls12381g1g2]: '',
  [KeyType.Bls12381g1]: '',
  [KeyType.Bls12381g2]: '',
}

@scoped(Lifecycle.ContainerScoped)
export class SecretResolverService implements SecretsResolver {
  private keyService: KeyService

  public constructor(keyService: KeyService) {
    this.keyService = keyService
  }

  public async find_secrets(secret_ids: Array<string>): Promise<Array<string>> {
    const secrets = []
    for (const secret_id of secret_ids) {
      const secret = await this.keyService.getById(secret_id)
      if (secret) {
        secrets.push(secret_id)
      }
    }
    return secrets
  }

  public async get_secret(secret_id: string): Promise<Secret | null> {
    const key = await this.keyService.findByKid(secret_id)
    if (!key) return null
    return {
      id: key.id,
      type: keyTypesMapping[key.keyType],
      // @ts-ignore // TODO: FIXME
      secret_material: key.privateKey,
    }
  }
}
