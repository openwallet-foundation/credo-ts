import type { KeyType } from '../../key-manager/KeyManager'

import { Lifecycle, scoped } from 'tsyringe'

import { KeyService } from './services/KeyService'

@scoped(Lifecycle.ContainerScoped)
export class KeysModule {
  private keyService: KeyService

  public constructor(keyService: KeyService) {
    this.keyService = keyService
  }

  public createKey(controller: string, kid?: string, keyType?: KeyType) {
    return this.keyService.createKey(controller, kid, keyType)
  }
}
