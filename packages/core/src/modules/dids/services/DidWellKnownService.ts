import { Lifecycle, scoped } from 'tsyringe'

import { DidInfo } from '../domain'

import { DidService } from './DidService'

@scoped(Lifecycle.ContainerScoped)
export class DidWellKnownService {
  private didService: DidService

  public constructor(didService: DidService) {
    this.didService = didService
  }

  public async resolve(did?: string) {
    if (!did) return undefined
    const didDoc = await this.didService.getDIDDoc(did)
    return new DidInfo({
      did,
      connectivity: didDoc.connectivity,
    })
  }
}
