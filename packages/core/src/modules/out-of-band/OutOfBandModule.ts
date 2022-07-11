import { Lifecycle, scoped } from 'tsyringe'

import { OutOfBandInvitationMessage } from './messages'
import { OutOfBandService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private outOfBandService: OutOfBandService

  public constructor(outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async createInvitation(params: {
    goalCode: string
    goal?: string
    usePublicDid?: boolean
  }): Promise<OutOfBandInvitationMessage> {
    return this.outOfBandService.createOutOfBandInvitation(params)
  }

  public receiveInvitationFromUrl(invitationUrl: string): OutOfBandInvitationMessage {
    return OutOfBandInvitationMessage.fromUrl(invitationUrl)
  }

  public async acceptInvitation(message: OutOfBandInvitationMessage): Promise<void> {
    return this.outOfBandService.acceptOutOfBandInvitation(message)
  }
}
