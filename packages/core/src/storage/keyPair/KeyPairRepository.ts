import type { KeyPairKeyTypes } from './KeyPairRecord'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { Repository } from '../Repository'
import { StorageService } from '../StorageService'

import { KeyPairRecord } from './KeyPairRecord'

import { InjectionSymbols } from '@aries-framework/core'

@scoped(Lifecycle.ContainerScoped)
export class KeyPairRepository extends Repository<KeyPairRecord> {
  public constructor(@inject(InjectionSymbols.StorageService) storageService: StorageService<KeyPairRecord>) {
    super(KeyPairRecord, storageService)
  }

  public async getKeyPair({ keyType, publicKeyBase58 }: GetKeyPairOptions) {
    return await this.getSingleByQuery({ keyType, publicKeyBase58 })
  }

  public async findKeyPair({ keyType, publicKeyBase58 }: GetKeyPairOptions) {
    return await this.findSingleByQuery({ keyType, publicKeyBase58 })
  }
}

type GetKeyPairOptions = {
  publicKeyBase58?: string
  keyType?: KeyPairKeyTypes
}
