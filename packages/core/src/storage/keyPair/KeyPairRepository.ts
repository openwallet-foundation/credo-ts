import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../../constants'
import { Repository } from '../Repository'
import { StorageService } from '../StorageService'

import { KeyPairRecord } from './KeyPairRecord'

@scoped(Lifecycle.ContainerScoped)
export class KeyPairRepository extends Repository<KeyPairRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<KeyPairRecord>) {
    super(KeyPairRecord, storageService)
  }

  /**
   * Get a keyPair record based on a base58 encoded public key
   *
   * @inheritDoc {Repository#getSingleByQuery}
   */
  public async getKeyPair({ publicKeyBase58 }: GetKeyPairOptions) {
    return await this.getSingleByQuery({ publicKeyBase58 })
  }

  /**
   * Find a keyPair record based on a base58 encoded public key
   *
   * @inheritDoc {Repository#findSingleByQuery}
   */
  public async findKeyPair({ publicKeyBase58 }: GetKeyPairOptions) {
    return await this.findSingleByQuery({ publicKeyBase58 })
  }
}

type GetKeyPairOptions = {
  publicKeyBase58?: string
}
