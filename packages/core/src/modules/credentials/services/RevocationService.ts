import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ConnectionRecord } from '../../connections'
import type { RevocationNotificationReceivedEvent } from '../CredentialEvents'
import type { V1RevocationNotificationMessage } from '../protocol/revocation-notification/messages/V1RevocationNotificationMessage'
import type { V2RevocationNotificationMessage } from '../protocol/revocation-notification/messages/V2RevocationNotificationMessage'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { CredentialEventTypes } from '../CredentialEvents'
import { RevocationNotification } from '../models/RevocationNotification'
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
    indyRevocationRegistryId: string,
    indyCredentialRevocationId: string,
    connection: ConnectionRecord,
    comment?: string
  ) {
    const query = { indyRevocationRegistryId, indyCredentialRevocationId }

    this.logger.trace(`Getting record by query for revocation notification:`, query)
    const credentialRecord = await this.credentialRepository.getSingleByQuery(query)

    credentialRecord.assertConnection(connection.id)

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
   * Process a received {@link V1RevocationNotificationMessage}. This will create a
   * {@link RevocationNotification} and store it in the corresponding {@link CredentialRecord}
   *
   * @param messageContext message context of RevocationNotificationMessageV1
   */
  public async v1ProcessRevocationNotification(
    messageContext: InboundMessageContext<V1RevocationNotificationMessage>
  ): Promise<void> {
    this.logger.info('Processing revocation notification v1', { message: messageContext.message })
    // ThreadID = indy::<revocation_registry_id>::<credential_revocation_id>
    const threadRegex =
      /(indy)::((?:[\dA-z]{21,22}):4:(?:[\dA-z]{21,22}):3:[Cc][Ll]:(?:(?:[1-9][0-9]*)|(?:[\dA-z]{21,22}:2:.+:[0-9.]+))(?::[\dA-z]+)?:CL_ACCUM:(?:[\dA-z-]+))::(\d+)$/
    const threadId = messageContext.message.issueThread
    try {
      const threadIdGroups = threadId.match(threadRegex)
      if (threadIdGroups) {
        const [, , indyRevocationRegistryId, indyCredentialRevocationId] = threadIdGroups
        const comment = messageContext.message.comment
        const connection = messageContext.assertReadyConnection()

        await this.processRevocationNotification(
          indyRevocationRegistryId,
          indyCredentialRevocationId,
          connection,
          comment
        )
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
   * Process a received {@link V2RevocationNotificationMessage}. This will create a
   * {@link RevocationNotification} and store it in the corresponding {@link CredentialRecord}
   *
   * @param messageContext message context of RevocationNotificationMessageV2
   */
  public async v2ProcessRevocationNotification(
    messageContext: InboundMessageContext<V2RevocationNotificationMessage>
  ): Promise<void> {
    this.logger.info('Processing revocation notification v2', { message: messageContext.message })

    // CredentialId = <revocation_registry_id>::<credential_revocation_id>
    const credentialIdRegex =
      /((?:[\dA-z]{21,22}):4:(?:[\dA-z]{21,22}):3:[Cc][Ll]:(?:(?:[1-9][0-9]*)|(?:[\dA-z]{21,22}:2:.+:[0-9.]+))(?::[\dA-z]+)?:CL_ACCUM:(?:[\dA-z-]+))::(\d+)$/
    const credentialId = messageContext.message.credentialId
    try {
      const credentialIdGroups = credentialId.match(credentialIdRegex)
      if (credentialIdGroups) {
        const [, indyRevocationRegistryId, indyCredentialRevocationId] = credentialIdGroups
        const comment = messageContext.message.comment
        const connection = messageContext.assertReadyConnection()
        await this.processRevocationNotification(
          indyRevocationRegistryId,
          indyCredentialRevocationId,
          connection,
          comment
        )
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
