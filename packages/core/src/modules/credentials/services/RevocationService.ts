import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { RevocationNotificationReceivedEvent } from '../CredentialEvents'
import type { RevocationNotificationMessage } from '../messages'

import { scoped, Lifecycle } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { CredentialEventTypes } from '../CredentialEvents'
import { RevocationNotification } from '../models'
import { CredentialRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class RevocationService {
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  /**
   * Process a recieved {@link RevocationNotificationMessage}. This will create a
   * {@link RevocationNotification} and store it in the corresponding {@link ConnectionRecord}
   *
   * @param threadId
   * @param comment
   */
  public async processRevocationNotification(
    messageContext: InboundMessageContext<RevocationNotificationMessage>
  ): Promise<void> {
    const threadId = messageContext.message.issueThread
    const comment = messageContext.message.comment

    const credentialRecord = await this.credentialRepository.getSingleByQuery({ threadId })

    credentialRecord.revocationNotification = new RevocationNotification(comment)
    await this.credentialRepository.update(credentialRecord)

    this.eventEmitter.emit<RevocationNotificationReceivedEvent>({
      type: CredentialEventTypes.RevocationNotificationReceived,
      payload: {
        credentialRecord,
      },
    })
  }
}
