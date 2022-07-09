import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { DidService, DidType } from '../../dids'
import { WellKnownService } from '../../well-known'
import { OutOfBandGoalCode, OutOfBandInvitationMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private didService: DidService
  private wellKnownService: WellKnownService

  public constructor(didService: DidService, wellKnownService: WellKnownService) {
    this.didService = didService
    this.wellKnownService = wellKnownService
  }

  public async createOutOfBandInvitation({
    goal,
    goalCode,
    usePublicDid,
  }: {
    goalCode: string
    goal?: string
    usePublicDid?: boolean
  }) {
    const did = await this.didService.getPublicOrCrateNewDid(DidType.PeerDid, usePublicDid)
    return new OutOfBandInvitationMessage({
      from: did.did,
      body: {
        goal,
        goal_code: goalCode,
      },
    })
  }

  public async acceptOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    if (message.body.goalCode === OutOfBandGoalCode.DidExchange) {
      const didInfo = await this.wellKnownService.resolve(message.from)
      if (!didInfo) {
        throw new AriesFrameworkError(`Unable to resolve info for the DID: ${message.from}`)
      }
      await this.didService.storeRemoteDid(didInfo)
    }
  }
}
