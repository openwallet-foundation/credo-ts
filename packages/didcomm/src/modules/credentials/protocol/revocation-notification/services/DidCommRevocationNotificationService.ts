import {
  type AgentContext,
  CredoError,
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
  type Logger,
} from '@credo-ts/core'
import type { DidCommInboundMessageContext } from '../../../../../models'
import { DidCommConnectionService } from '../../../../connections'
import { keyAgreementsEqual } from '../../../../connections/services/helpers'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../DidCommCredentialEvents'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import { DidCommCredentialsModuleConfig } from '../../../DidCommCredentialsModuleConfig'
import { DidCommRevocationNotification } from '../../../models/DidCommRevocationNotification'
import { DidCommCredentialExchangeRecord, DidCommCredentialExchangeRepository } from '../../../repository'
import type { DidCommRevocationNotificationFormatService } from '../DidCommRevocationNotificationFormatService'
import { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'
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
    formatService: DidCommRevocationNotificationFormatService,
    credentialId: string,
    revocationFormat: string,
    comment?: string
  ) {
    const { agentContext } = messageContext
    const connection = messageContext.connection ? messageContext.assertReadyConnection() : undefined
    const credentialExchangeRecord = await formatService.findCredentialExchangeRecord(
      agentContext,
      credentialId,
      revocationFormat,
      connection?.id
    )

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

  public getFormatServiceForFormat(
    agentContext: AgentContext,
    revocationFormat: string
  ): DidCommRevocationNotificationFormatService {
    const formatService = agentContext.dependencyManager
      .resolve(DidCommCredentialsModuleConfig)
      .revocationNotificationFormats.find(({ supportedRevocationFormats }) =>
        supportedRevocationFormats.includes(revocationFormat)
      )

    if (!formatService) {
      throw new CredoError(`Unknown revocation format: ${revocationFormat}`)
    }

    return formatService
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

    const { credentialId, revocationFormat, comment } = messageContext.message
    const formatService = this.getFormatServiceForFormat(messageContext.agentContext, revocationFormat)

    try {
      await this.processRevocationNotification(messageContext, formatService, credentialId, revocationFormat, comment)
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, credentialId })
    }
  }
}
