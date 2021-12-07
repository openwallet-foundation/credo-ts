import { RevocationNotificationMessage } from '../messages'
import { RevocationNotification } from '../models'
import { CredentialRepository } from '../repository'
import { InboundMessageContext } from 'packages/core/src/agent/models/InboundMessageContext'
import { EventEmitter } from '../../../agent/EventEmitter'
import { scoped, Lifecycle } from 'tsyringe'
import { CredentialEventTypes, RevocationNotificationReceivedEvent } from '@aries-framework/core'

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
    let threadId = messageContext.message.issueThread
    let comment = messageContext.message.comment
    let credentialRecord = await this.credentialRepository.getSingleByQuery({ threadId })
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
