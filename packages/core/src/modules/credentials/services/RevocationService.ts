import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { RevocationNotificationReceivedEvent } from '../CredentialEvents'
import type { RevocationNotificationMessageV1, RevocationNotificationMessageV2 } from '../messages'

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

  private async processRevocationNotification(
    revocationRegistryId: string,
    credentialRevocationId: string,
    comment?: string
  ) {
    const query = { revocationRegistryId, credentialRevocationId }
    this.logger.trace(`Getting record by query for revocation notification:`, query)
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
  }

  /**
   * Process a recieved {@link RevocationNotificationMessagev1}. This will create a
   * {@link RevocationNotification} and store it in the corresponding {@link ConnectionRecord}
   *
   * @param messageContext message context of RevocationNotificationMessageV1
   */
  public async processRevocationNotificationV1(
    messageContext: InboundMessageContext<RevocationNotificationMessageV1>
  ): Promise<void> {
    try {
      this.logger.info('Processing revocation notification v1', { message: messageContext.message })
      // ThreadID = indy::<revocation_registry_id>::<credential_revocation_id>
      const threadRegex = /(indy)::(.+)::(\d+)$/
      const threadId = messageContext.message.issueThread
      const threadIdGroups = threadId.match(threadRegex)
      if (threadIdGroups) {
        const [, , revocationRegistryId, credentialRevocationId] = threadIdGroups
        const comment = messageContext.message.comment
        this.processRevocationNotification(revocationRegistryId, credentialRevocationId, comment)
      } else {
        throw new AriesFrameworkError(
          `Incorrect revocation notification threadId format: \n${threadId}\ndoes not match\n"indy::<revocation_registry_id>::<credential_revocation_id>"`
        )
      }
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, threadId })
    }
  }

  /**
   * Process a recieved {@link RevocationNotificationMessagev2}. This will create a
   * {@link RevocationNotification} and store it in the corresponding {@link ConnectionRecord}
   *
   * @param messageContext message context of RevocationNotificationMessageV2
   */
  public async processRevocationNotificationV2(
    messageContext: InboundMessageContext<RevocationNotificationMessageV2>
  ): Promise<void> {
    try {
      this.logger.info('Processing revocation notification v2', { message: messageContext.message })
      // CredentialId = <revocation_registry_id>::<credential_revocation_id>
      const credentialIdRegex = /(.*)::(\d+)$/
      const credentialId = messageContext.message.credentialId
      const credentialIdGroups = credentialId.match(credentialIdRegex)
      if (credentialIdGroups) {
        const [, revocationRegistryId, credentialRevocationId] = credentialIdGroups
        const comment = messageContext.message.comment
        this.processRevocationNotification(revocationRegistryId, credentialRevocationId, comment)
      } else {
        throw new AriesFrameworkError(
          `Incorrect revocation notification credentialId format: \n${credentialId}\ndoes not match\n"<revocation_registry_id>::<credential_revocation_id>"`
        )
      }
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, credentialId })
    }
  }
}
