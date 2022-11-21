import type { DependencyManager } from '../../plugins'
import type { Transports } from '../routing/types'

import { Dispatcher } from '../../agent/Dispatcher'
import { module, injectable } from '../../plugins'

import { OutOfBandInvitationHandler } from './handlers/OutOfBandInvitationHandler'
import { OutOfBandInvitationMessage } from './messages'
import { OutOfBandService } from './services'

@module()
@injectable()
export class OutOfBandModule {
  private outOfBandService: OutOfBandService

  public constructor(dispatcher: Dispatcher, outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
    this.registerHandlers(dispatcher)
  }

  public async createInvitation(params: {
    to?: string
    goalCode: string
    goal?: string
    attachments?: Record<string, unknown>[]
    usePublicDid?: boolean
    transport?: Transports
  }): Promise<OutOfBandInvitationMessage> {
    const message = await this.outOfBandService.createOutOfBandInvitation(params)
    if (params.transport) {
      await this.outOfBandService.sendMessage(message, params.transport)
    }
    return message
  }

  public receiveInvitationFromUrl(invitationUrl: string): OutOfBandInvitationMessage {
    return OutOfBandInvitationMessage.fromLink({ url: invitationUrl })
  }

  public async acceptInvitation(message: OutOfBandInvitationMessage): Promise<void> {
    return this.outOfBandService.acceptOutOfBandInvitation(message)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new OutOfBandInvitationHandler(this.outOfBandService))
  }

  /**
   * Registers the dependencies of the Out-of-Band module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(OutOfBandModule)

    // Services
    dependencyManager.registerSingleton(OutOfBandService)
  }
}
