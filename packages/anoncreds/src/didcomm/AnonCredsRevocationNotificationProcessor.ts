import type { AgentContext, Query } from '@credo-ts/core'
import { CredoError, EventEmitter, InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import type {
  DidCommConnectionRecord,
  DidCommInboundMessageContext,
  DidCommRevocationNotificationProcessor,
  DidCommRevocationNotificationReceivedEvent,
  DidCommRevocationNotificationV1Message,
} from '@credo-ts/didcomm'
import {
  DidCommCredentialEventTypes,
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
  DidCommRevocationNotification,
  DidCommRevocationNotificationV2Message,
} from '@credo-ts/didcomm'
import {
  v1ThreadRegex,
  v2AnonCredsRevocationFormat,
  v2AnonCredsRevocationIdentifierRegex,
  v2IndyRevocationFormat,
  v2IndyRevocationIdentifierRegex,
} from './revocationIdentifier'

@injectable()
export class AnonCredsRevocationNotificationProcessor implements DidCommRevocationNotificationProcessor {
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
    agentContext: AgentContext,
    revocationRegistryId: string,
    credentialRevocationId: string,
    connection: DidCommConnectionRecord,
    comment?: string
  ) {
    const query: Query<DidCommCredentialExchangeRecord> = {
      anonCredsRevocationRegistryId: revocationRegistryId,
      anonCredsCredentialRevocationId: credentialRevocationId,
      connectionId: connection.id,
    }

    this.logger.trace('Getting record by query for revocation notification:', query)
    const credentialExchangeRecord = await this.credentialRepository.getSingleByQuery(agentContext, query)

    credentialExchangeRecord.revocationNotification = new DidCommRevocationNotification(comment)
    await this.credentialRepository.update(agentContext, credentialExchangeRecord)

    this.logger.trace('Emitting DidCommRevocationNotificationReceivedEvent')
    this.eventEmitter.emit<DidCommRevocationNotificationReceivedEvent>(agentContext, {
      type: DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
      payload: {
        credentialExchangeRecord: credentialExchangeRecord.clone(),
      },
    })
  }

  public async processV1(messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV1Message>) {
    this.logger.info('Processing revocation notification v1', { message: messageContext.message })

    const threadId = messageContext.message.issueThread
    try {
      const threadIdGroups = threadId.match(v1ThreadRegex)
      if (!threadIdGroups) {
        throw new CredoError(
          `Incorrect revocation notification threadId format: \n${threadId}\ndoes not match\n"indy::<revocation_registry_id>::<credential_revocation_id>"`
        )
      }

      const [, , revocationRegistryId, credentialRevocationId] = threadIdGroups
      const connection = messageContext.assertReadyConnection()
      await this.processRevocationNotification(
        messageContext.agentContext,
        revocationRegistryId,
        credentialRevocationId,
        connection,
        messageContext.message.comment
      )
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, threadId })
    }
  }

  public async processV2(messageContext: DidCommInboundMessageContext<DidCommRevocationNotificationV2Message>) {
    this.logger.info('Processing revocation notification v2', { message: messageContext.message })

    const { credentialId, revocationFormat, comment } = messageContext.message
    if (![v2IndyRevocationFormat, v2AnonCredsRevocationFormat].includes(revocationFormat)) {
      throw new CredoError(
        `Unknown revocation format: ${revocationFormat}. Supported formats are indy-anoncreds and anoncreds`
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

      const [, revocationRegistryId, credentialRevocationId] = credentialIdGroups
      const connection = messageContext.assertReadyConnection()
      await this.processRevocationNotification(
        messageContext.agentContext,
        revocationRegistryId,
        credentialRevocationId,
        connection,
        comment
      )
    } catch (error) {
      this.logger.warn('Failed to process revocation notification message', { error, credentialId })
    }
  }
}
