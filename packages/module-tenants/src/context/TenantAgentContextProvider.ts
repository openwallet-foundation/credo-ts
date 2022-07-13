import type { AgentContextProvider, RoutingCreatedEvent, EncryptedMessage } from '@aries-framework/core'

import {
  AriesFrameworkError,
  injectable,
  AgentContext,
  EventEmitter,
  inject,
  Logger,
  RoutingEventTypes,
  InjectionSymbols,
  KeyType,
  Key,
  isValidJweStructure,
  JsonEncoder,
  isJsonObject,
} from '@aries-framework/core'

import { TenantRecordService } from '../services'

import { TenantSessionCoordinator } from './TenantSessionCoordinator'

@injectable()
export class TenantAgentContextProvider implements AgentContextProvider {
  private tenantRecordService: TenantRecordService
  private rootAgentContext: AgentContext
  private eventEmitter: EventEmitter
  private logger: Logger
  private tenantSessionCoordinator: TenantSessionCoordinator

  public constructor(
    tenantRecordService: TenantRecordService,
    rootAgentContext: AgentContext,
    eventEmitter: EventEmitter,
    tenantSessionCoordinator: TenantSessionCoordinator,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.tenantRecordService = tenantRecordService
    this.rootAgentContext = rootAgentContext
    this.eventEmitter = eventEmitter
    this.tenantSessionCoordinator = tenantSessionCoordinator
    this.logger = logger

    // Start listener for newly created routing keys, so we can register a mapping for each new key for the tenant
    this.listenForRoutingKeyCreatedEvents()
  }

  public async getAgentContextForContextCorrelationId(tenantId: string) {
    // TODO: maybe we can look at not having to retrieve the tenant record if there's already a context available.
    const tenantRecord = await this.tenantRecordService.getTenantById(this.rootAgentContext, tenantId)
    const agentContext = this.tenantSessionCoordinator.getContextForSession(tenantRecord)

    this.logger.debug(`Created tenant agent context for tenant '${tenantId}'`)

    return agentContext
  }

  public async getContextForInboundMessage(inboundMessage: unknown, options?: { contextCorrelationId?: string }) {
    this.logger.debug('Getting context for inbound message in tenant agent context provider', {
      contextCorrelationId: options?.contextCorrelationId,
    })

    let tenantId = options?.contextCorrelationId
    let recipientKeys: Key[] = []

    if (!tenantId && isValidJweStructure(inboundMessage)) {
      this.logger.trace("Inbound message is a JWE, extracting tenant id from JWE's protected header")
      recipientKeys = this.getRecipientKeysFromEncryptedMessage(inboundMessage)

      this.logger.trace(`Found ${recipientKeys.length} recipient keys in JWE's protected header`)

      // FIXME: what if there are multiple recipients in the same agent? If we receive the messages twice we will process it for
      // the first found recipient multiple times. This is however a case I've never seen before and will add quite some complexity
      // to resolve. I think we're fine to ignore this case for now.
      for (const recipientKey of recipientKeys) {
        const tenantRoutingRecord = await this.tenantRecordService.findTenantRoutingRecordByRecipientKey(
          this.rootAgentContext,
          recipientKey
        )

        if (tenantRoutingRecord) {
          this.logger.debug(`Found tenant routing record for recipient key ${recipientKeys[0].fingerprint}`, {
            tenantId: tenantRoutingRecord.tenantId,
          })
          tenantId = tenantRoutingRecord.tenantId
          break
        }
      }
    }

    if (!tenantId) {
      this.logger.error("Couldn't determine tenant id for inbound message. Unable to create context", {
        inboundMessage,
        recipientKeys: recipientKeys.map((key) => key.fingerprint),
      })
      throw new AriesFrameworkError("Couldn't determine tenant id for inbound message. Unable to create context")
    }

    const agentContext = await this.getAgentContextForContextCorrelationId(tenantId)

    return agentContext
  }

  public async endSessionForAgentContext(agentContext: AgentContext) {
    await this.tenantSessionCoordinator.endAgentContextSession(agentContext)
  }

  private getRecipientKeysFromEncryptedMessage(jwe: EncryptedMessage): Key[] {
    const jweProtected = JsonEncoder.fromBase64(jwe.protected)
    if (!Array.isArray(jweProtected.recipients)) return []

    const recipientKeys: Key[] = []

    for (const recipient of jweProtected.recipients) {
      // Check if recipient.header.kid is a string
      if (isJsonObject(recipient) && isJsonObject(recipient.header) && typeof recipient.header.kid === 'string') {
        // This won't work with other key types, we should detect what the encoding is of kid, and based on that
        // determine how we extract the key from the message
        const key = Key.fromPublicKeyBase58(recipient.header.kid, KeyType.Ed25519)
        recipientKeys.push(key)
      }
    }

    return recipientKeys
  }

  private async registerRecipientKeyForTenant(tenantId: string, recipientKey: Key) {
    this.logger.debug(`Registering recipient key ${recipientKey.fingerprint} for tenant ${tenantId}`)
    const tenantRecord = await this.tenantRecordService.getTenantById(this.rootAgentContext, tenantId)
    await this.tenantRecordService.addTenantRoutingRecord(this.rootAgentContext, tenantRecord.id, recipientKey)
  }

  private listenForRoutingKeyCreatedEvents() {
    this.logger.debug('Listening for routing key created events in tenant agent context provider')
    this.eventEmitter.on<RoutingCreatedEvent>(RoutingEventTypes.RoutingCreatedEvent, async (event) => {
      const contextCorrelationId = event.metadata.contextCorrelationId
      const recipientKey = event.payload.routing.recipientKey

      // We don't want to register the key if it's for the root agent context
      if (contextCorrelationId === this.rootAgentContext.contextCorrelationId) return

      this.logger.debug(
        `Received routing key created event for tenant ${contextCorrelationId}, registering recipient key ${recipientKey.fingerprint} in base wallet`
      )
      await this.registerRecipientKeyForTenant(contextCorrelationId, recipientKey)
    })
  }
}
