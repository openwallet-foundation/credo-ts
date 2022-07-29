import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'

import { OutOfBandInvitationHandler } from './handlers/OutOfBandInvitationHandler'
import { OutOfBandInvitationMessage } from './messages'
import { OutOfBandService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private outOfBandService: OutOfBandService

  public constructor(dispatcher: Dispatcher, outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
    this.registerHandlers(dispatcher)
  }

  public async createInvitation(params: {
    goalCode: string
    goal?: string
    attachments?: Record<string, unknown>[]
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

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new OutOfBandInvitationHandler(this.outOfBandService))
  }
}
