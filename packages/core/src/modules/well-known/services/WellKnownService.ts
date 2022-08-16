import { Lifecycle, scoped } from 'tsyringe'

import { DidService } from '../../dids/services'
import { DidInfo } from '../models'

@scoped(Lifecycle.ContainerScoped)
export class WellKnownService {
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
