import { Lifecycle, scoped } from 'tsyringe'

import { DidInfo } from '../models'

@scoped(Lifecycle.ContainerScoped)
export class WellKnownService {
  public async resolve(did?: string) {
    if (!did) return undefined
    return new DidInfo({
      did,
    })
  }
}
