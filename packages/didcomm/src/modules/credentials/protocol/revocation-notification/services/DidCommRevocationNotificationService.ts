import type { AgentContext } from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '../../../../../models'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../DidCommCredentialEvents'
import type { DidCommRevocationNotificationV1Message } from '../messages/DidCommRevocationNotificationV1Message'
import type { V2DidCommCreateRevocationNotificationMessageOptions } from './DidCommRevocationNotificationServiceOptions'

import { CredoError, EventEmitter, InjectionSymbols, type Logger, inject, injectable } from '@credo-ts/core'

import { DidCommMessageHandlerRegistry } from '../../../../../DidCommMessageHandlerRegistry'
import { DidCommConnectionRecord } from '../../../../connections'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import { DidCommRevocationNotification } from '../../../models/DidCommRevocationNotification'
import { DidCommCredentialExchangeRepository } from '../../../repository'
import { DidCommRevocationNotificationV1Handler, DidCommRevocationNotificationV2Handler } from '../handlers'
import { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'
import {
  v1ThreadRegex,
  v2AnonCredsRevocationFormat,
  v2AnonCredsRevocationIdentifierRegex,
  v2IndyRevocationFormat,
  v2IndyRevocationIdentifierRegex,
} from '../util/revocationIdentifier'

@injectable()
export class DidCommRevocationNotificationService {
  private credentialRepository: DidCommCredentialExchangeRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    credentialRepository: DidCommCredentialExchangeRepository,
    eventEmitter: EventEmitter,
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.logger = logger

    this.registerMessageHandlers(messageHandlerRegistry)
  }

  private async processRevocationNotification(
    agentContext: AgentContext,
    anonCredsRevocationRegistryId: string,
    anonCredsCredentialRevocationId: string,
    connection: DidCommConnectionRecord,
    comment?: string
  ) {
    // TODO: can we extract support for this revocation notification handler to the anoncreds module?
    // Search for the revocation registry in both qualified and unqualified forms
    const query = {
      $or: [
        {
          anonCredsRevocationRegistryId,
          anonCredsCredentialRevocationId,
          connectionId: connection.id,
        },
        {
          anonCredsUnqualifiedRevocationRegistryId: anonCredsRevocationRegistryId,
          anonCredsCredentialRevocationId,
          connectionId: connection.id,
        },
      ],
    }

    this.logger.trace('Getting record by query for revocation notification:', query)
    const credentialExchangeRecord = await this.credentialRepository.getSingleByQuery(agentContext, query)

    credentialExchangeRecord.revocationNotification = new DidCommRevocationNotification(comment)
    await this.credentialRepository.update(agentContext, credentialExchangeRecord)

    this.logger.trace('Emitting DidCommRevocationNotificationReceivedEvent')
    this.eventEmitter.emit<DidCommRevocationNotificationReceivedEvent>(agentContext, {
      type: DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
      payload: {
        // Clone record to prevent mutations after emitting event.
        credentialExchangeRecord: credentialExchangeRecord.clone(),
      },
    })
  }

  /**
   * Process a received {@link DidCommRevocationNotificationV1Message}. This will create a
   * {@link DidCommRevocationNotification} and store it in the corresponding {@link CredentialRecord}
   *
   * @param messageContext message context of RevocationNotificationMessageV1
   */
  public async v1ProcessRevocationNotification(
    messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV1Message>
  ): Promise<void> {
    this.logger.info('Processing revocation notification v1', { message: messageContext.message })

    // ThreadID = indy::<revocation_registry_id>::<credential_revocation_id>
    const threadId = messageContext.message.issueThread

    try {
      const threadIdGroups = threadId.match(v1ThreadRegex)
      if (!threadIdGroups) {
        throw new CredoError(
          `Incorrect revocation notification threadId format: \n${threadId}\ndoes not match\n"indy::<revocation_registry_id>::<credential_revocation_id>"`
        )
      }

      const [, , anonCredsRevocationRegistryId, anonCredsCredentialRevocationId] = threadIdGroups
      const comment = messageContext.message.comment
      const connection = messageContext.assertReadyConnection()

      await this.processRevocationNotification(
        messageContext.agentContext,
        anonCredsRevocationRegistryId,
        anonCredsCredentialRevocationId,
        connection,
        comment
      )
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, threadId })
    }
  }

  /**
   * Create a V2 Revocation Notification message
   */

  public async v2CreateRevocationNotification(
    options: V2DidCommCreateRevocationNotificationMessageOptions
  ): Promise<{ message: DidCommRevocationNotificationV2Message }> {
    const { credentialId, revocationFormat, comment, requestAck } = options
    const message = new DidCommRevocationNotificationV2Message({
      credentialId,
      revocationFormat,
      comment,
    })
    if (requestAck) {
      message.setPleaseAck()
    }

    return { message }
  }

  /**
   * Process a received {@link DidCommRevocationNotificationV2Message}. This will create a
   * {@link DidCommRevocationNotification} and store it in the corresponding {@link CredentialRecord}
   *
   * @param messageContext message context of RevocationNotificationMessageV2
   */
  public async v2ProcessRevocationNotification(
    messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV2Message>
  ): Promise<void> {
    this.logger.info('Processing revocation notification v2', { message: messageContext.message })

    const credentialId = messageContext.message.credentialId

    if (![v2IndyRevocationFormat, v2AnonCredsRevocationFormat].includes(messageContext.message.revocationFormat)) {
      throw new CredoError(
        `Unknown revocation format: ${messageContext.message.revocationFormat}. Supported formats are indy-anoncreds and anoncreds`
      )
    }

    try {
      const credentialIdGroups =
        credentialId.match(v2IndyRevocationIdentifierRegex) ?? credentialId.match(v2AnonCredsRevocationIdentifierRegex)
      if (!credentialIdGroups) {
        throw new CredoError(
          `Incorrect revocation notification credentialId format: \n${credentialId}\ndoes not match\n"<revocation_registry_id>::<credential_revocation_id>"`
        )
      }

      const [, anonCredsRevocationRegistryId, anonCredsCredentialRevocationId] = credentialIdGroups
      const comment = messageContext.message.comment
      const connection = messageContext.assertReadyConnection()
      await this.processRevocationNotification(
        messageContext.agentContext,
        anonCredsRevocationRegistryId,
        anonCredsCredentialRevocationId,
        connection,
        comment
      )
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, credentialId })
    }
  }

  private registerMessageHandlers(messageHandlerRegistry: DidCommMessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DidCommRevocationNotificationV1Handler(this))
    messageHandlerRegistry.registerMessageHandler(new DidCommRevocationNotificationV2Handler(this))
  }
}
