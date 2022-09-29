import { Lifecycle, scoped } from 'tsyringe'

import { KeyService } from './services/KeyService'

@scoped(Lifecycle.ContainerScoped)
export class KeysModule {
  private keyService: KeyService

  public constructor(keyService: KeyService) {
    this.keyService = keyService
  }
}
