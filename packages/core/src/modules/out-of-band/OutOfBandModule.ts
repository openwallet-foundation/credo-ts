import type { OutOfBandInvitationMessage } from './services/OutOfBandInvitationMessage'
import type { OutOfBandService } from './services/OutOfBandService'

export class OutOfBandModule {
  private outOfBandService: OutOfBandService

  public constructor(outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public createOutOfBandInvitation(message: { goal: string; goalCode: string; usePublicDid?: boolean }) {
    return this.outOfBandService.createOutOfBandInvitation(message)
  }

  public acceptOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    this.outOfBandService.acceptOutOfBandInvitation(message)
  }
}
