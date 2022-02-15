import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { RevocationNotificationReceivedEvent } from '../CredentialEvents'
import type { RevocationNotificationMessage } from '../messages'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { CredentialEventTypes } from '../CredentialEvents'
import { RevocationNotification } from '../models'
import { CredentialRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class RevocationService {
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter, agentConfig: AgentConfig) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
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
    this.logger.info('Processing revocation notification', { message: messageContext.message })
    // ThreadID = indy::<revocation_registry_id>::<credential_revocation_id>
    const threadRegex = /(indy)::(.+)::(\d+)$/
    const threadId = messageContext.message.issueThread
    try {
      const threadIdGroups = threadId.match(threadRegex)

      if (threadIdGroups) {
        const [credentialFormat, revocationRegistryId, credentialRevocationId] = threadIdGroups
        const comment = messageContext.message.comment
        const query = { revocationRegistryId, credentialRevocationId }
        this.logger.trace(
          `Getting record by query for revocation notification using credential revocation format: ${credentialFormat}`,
          query
        )
        const credentialRecord = await this.credentialRepository.getSingleByQuery(query)

        credentialRecord.revocationNotification = new RevocationNotification(comment)
        await this.credentialRepository.update(credentialRecord)

        this.logger.trace('Emitting RevocationNotificationReceivedEvent')
        this.eventEmitter.emit<RevocationNotificationReceivedEvent>({
          type: CredentialEventTypes.RevocationNotificationReceived,
          payload: {
            credentialRecord,
          },
        })
      } else {
        throw new AriesFrameworkError(
          `Incorrect revocation notification threadId format: \n${threadId}\ndoes not match\n"indy::<revocation_registry_id>::<credential_revocation_id>"`
        )
      }
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, threadId })
    }
  }
}
