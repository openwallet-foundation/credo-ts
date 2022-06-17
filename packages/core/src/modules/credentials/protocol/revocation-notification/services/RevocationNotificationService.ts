import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../../../logger'
import type { ConnectionRecord } from '../../../../connections'
import type { RevocationNotificationReceivedEvent } from '../../../CredentialEvents'
import type { V1RevocationNotificationMessage } from '../messages/V1RevocationNotificationMessage'
import type { V2RevocationNotificationMessage } from '../messages/V2RevocationNotificationMessage'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../../../agent/AgentConfig'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { JsonTransformer } from '../../../../../utils'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { RevocationNotification } from '../../../models/RevocationNotification'
import { CredentialRepository } from '../../../repository'
import { V1RevocationNotificationHandler, V2RevocationNotificationHandler } from '../handlers'
import { v1ThreadRegex, v2IndyRevocationFormat, v2IndyRevocationIdentifierRegex } from '../util/revocationIdentifier'

@scoped(Lifecycle.ContainerScoped)
export class RevocationNotificationService {
  private credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter
  private dispatcher: Dispatcher
  private logger: Logger

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    agentConfig: AgentConfig,
    dispatcher: Dispatcher
  ) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.dispatcher = dispatcher
    this.logger = agentConfig.logger

    this.registerHandlers()
  }

  private async processRevocationNotification(
    indyRevocationRegistryId: string,
    indyCredentialRevocationId: string,
    connection: ConnectionRecord,
    comment?: string
  ) {
    const query = { indyRevocationRegistryId, indyCredentialRevocationId, connectionId: connection.id }

    this.logger.trace(`Getting record by query for revocation notification:`, query)
    const credentialRecord = await this.credentialRepository.getSingleByQuery(query)

    credentialRecord.revocationNotification = new RevocationNotification(comment)
    await this.credentialRepository.update(credentialRecord)

    // Clone record to prevent mutations after emitting event.
    const clonedCredentialRecord = JsonTransformer.clone(credentialRecord)

    this.logger.trace('Emitting RevocationNotificationReceivedEvent')
    this.eventEmitter.emit<RevocationNotificationReceivedEvent>({
      type: CredentialEventTypes.RevocationNotificationReceived,
      payload: {
        credentialRecord: clonedCredentialRecord,
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
    const threadId = messageContext.message.issueThread

    try {
      const threadIdGroups = threadId.match(v1ThreadRegex)
      if (!threadIdGroups) {
        throw new AriesFrameworkError(
          `Incorrect revocation notification threadId format: \n${threadId}\ndoes not match\n"indy::<revocation_registry_id>::<credential_revocation_id>"`
        )
      }

      const [, , indyRevocationRegistryId, indyCredentialRevocationId] = threadIdGroups
      const comment = messageContext.message.comment
      const connection = messageContext.assertReadyConnection()

      await this.processRevocationNotification(
        indyRevocationRegistryId,
        indyCredentialRevocationId,
        connection,
        comment
      )
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

    const credentialId = messageContext.message.credentialId

    if (messageContext.message.revocationFormat !== v2IndyRevocationFormat) {
      throw new AriesFrameworkError(
        `Unknown revocation format: ${messageContext.message.revocationFormat}. Supported formats are indy-anoncreds`
      )
    }

    try {
      const credentialIdGroups = credentialId.match(v2IndyRevocationIdentifierRegex)
      if (!credentialIdGroups) {
        throw new AriesFrameworkError(
          `Incorrect revocation notification credentialId format: \n${credentialId}\ndoes not match\n"<revocation_registry_id>::<credential_revocation_id>"`
        )
      }

      const [, indyRevocationRegistryId, indyCredentialRevocationId] = credentialIdGroups
      const comment = messageContext.message.comment
      const connection = messageContext.assertReadyConnection()
      await this.processRevocationNotification(
        indyRevocationRegistryId,
        indyCredentialRevocationId,
        connection,
        comment
      )
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, credentialId })
    }
  }

  private registerHandlers() {
    this.dispatcher.registerHandler(new V1RevocationNotificationHandler(this))
    this.dispatcher.registerHandler(new V2RevocationNotificationHandler(this))
  }
}
