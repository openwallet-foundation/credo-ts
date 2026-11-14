import { CredoError, EventEmitter, InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '../../../../../models'
import { DidCommConnectionRecord, DidCommConnectionService } from '../../../../connections'
import { keyAgreementsEqual } from '../../../../connections/services/helpers'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../DidCommCredentialEvents'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import { DidCommCredentialsModuleConfig } from '../../../DidCommCredentialsModuleConfig'
import { DidCommCredentialRole } from '../../../models'
import { DidCommRevocationNotification } from '../../../models/DidCommRevocationNotification'
import { DidCommCredentialExchangeRecord, DidCommCredentialExchangeRepository } from '../../../repository'
import type { DidCommRevocationNotificationV1Message } from '../messages/DidCommRevocationNotificationV1Message'
import { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'
import {
  v1ThreadRegex,
  v2AnonCredsRevocationFormat,
  v2AnonCredsRevocationIdentifierRegex,
  v2IndyRevocationFormat,
  v2IndyRevocationIdentifierRegex,
} from '../util/revocationIdentifier'
import type { V2DidCommCreateRevocationNotificationMessageOptions } from './DidCommRevocationNotificationServiceOptions'

@injectable()
export class DidCommRevocationNotificationService {
  private credentialRepository: DidCommCredentialExchangeRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    credentialRepository: DidCommCredentialExchangeRepository,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
    this.logger = logger
  }

  private async processRevocationNotification(
    messageContext: DidCommInboundMessageContext,
    anonCredsRevocationRegistryId: string,
    anonCredsCredentialRevocationId: string,
    connection?: DidCommConnectionRecord,
    comment?: string
  ) {
    const { agentContext } = messageContext
    // TODO: can we extract support for this revocation notification handler to the anoncreds module?
    const query = connection
      ? { anonCredsRevocationRegistryId, anonCredsCredentialRevocationId, connectionId: connection.id }
      : { anonCredsRevocationRegistryId, anonCredsCredentialRevocationId, role: DidCommCredentialRole.Holder }

    this.logger.trace('Getting record by query for revocation notification:', query)
    const credentialExchangeRecord = await this.credentialRepository.getSingleByQuery(agentContext, query)

    if (!connection) {
      await this.assertSentByConnectionlessIssuer(messageContext, credentialExchangeRecord)
    }

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

  private async assertSentByConnectionlessIssuer(
    messageContext: DidCommInboundMessageContext,
    credentialExchangeRecord: DidCommCredentialExchangeRecord
  ): Promise<void> {
    const { agentContext } = messageContext
    const protocol = agentContext.dependencyManager
      .resolve(DidCommCredentialsModuleConfig)
      .credentialProtocols.find(({ version }) => version === credentialExchangeRecord.protocolVersion)
    if (!protocol) {
      throw new CredoError(
        `No credential protocol registered for protocol version ${credentialExchangeRecord.protocolVersion}`
      )
    }

    const credentialMessage = await protocol.findCredentialMessage(agentContext, credentialExchangeRecord.id)
    if (!credentialMessage) {
      throw new CredoError(`No credential message found for credential record with id '${credentialExchangeRecord.id}'`)
    }
    const requestMessage = await protocol.findRequestMessage(agentContext, credentialExchangeRecord.id)
    if (!requestMessage) {
      throw new CredoError(`No request message found for credential record with id '${credentialExchangeRecord.id}'`)
    }

    await agentContext.dependencyManager
      .resolve(DidCommConnectionService)
      .assertConnectionOrOutOfBandExchange(messageContext, {
        lastReceivedMessage: credentialMessage,
        lastSentMessage: requestMessage,
        expectedConnectionId: credentialExchangeRecord.connectionId,
      })

    // The shared check trusts the notification's own ~service, so pin the sender to the credential message ~service.
    const senderKey = messageContext.senderKeyAgreementKey ?? messageContext.senderKey
    const issuerKeys = credentialMessage.service?.resolvedDidCommService.recipientKeys ?? []
    if (!senderKey || !issuerKeys.some((key) => keyAgreementsEqual(senderKey, key))) {
      throw new CredoError(
        `Sender key ${senderKey?.fingerprint} not found in the ~service of credential message ${credentialMessage.id}`
      )
    }
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
      const connection = messageContext.connection ? messageContext.assertReadyConnection() : undefined

      await this.processRevocationNotification(
        messageContext,
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
      const connection = messageContext.connection ? messageContext.assertReadyConnection() : undefined
      await this.processRevocationNotification(
        messageContext,
        anonCredsRevocationRegistryId,
        anonCredsCredentialRevocationId,
        connection,
        comment
      )
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, credentialId })
    }
  }
}
