import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids'
import { WellKnownService } from '../../well-known'
import { OutOfBandGoalCode, OutOfBandInvitationMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private agentConfig: AgentConfig
  private didService: DidService
  private wellKnownService: WellKnownService

  public constructor(agentConfig: AgentConfig, didService: DidService, wellKnownService: WellKnownService) {
    this.agentConfig = agentConfig
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
    const did = await this.didService.getPublicDidOrCreateNew(usePublicDid)
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
