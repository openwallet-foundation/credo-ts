import {
  AgentContext,
  type AgentContextProvider,
  CredoError,
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
  isJsonObject,
  isStorageUpToDate,
  JsonEncoder,
  Kms,
  type Logger,
  TypedArrayEncoder,
  UpdateAssistant,
  type UpdateAssistantUpdateOptions,
} from '@credo-ts/core'
import type { DidCommEncryptedMessage, DidCommRoutingCreatedEvent } from '@credo-ts/didcomm'
import { DidCommRoutingEventTypes, isValidJweStructure } from '@credo-ts/didcomm'
import type { TenantRecord } from '../repository'
import { TenantRecordService } from '../services'
import { TenantAgent } from '../TenantAgent'

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

  public getContextCorrelationIdForTenantId(tenantId: string) {
    return this.tenantSessionCoordinator.getContextCorrelationIdForTenantId(tenantId)
  }

  public async getAgentContextForContextCorrelationId(
    contextCorrelationId: string,
    { provisionContext = false }: { provisionContext?: boolean } = {}
  ) {
    // It could be that the root agent context is requested, in that case we return the root agent context
    if (contextCorrelationId === this.rootAgentContext.contextCorrelationId) {
      return this.rootAgentContext
    }

    // If not the root agent context, we require it to be a tenant context correlation id
    this.tenantSessionCoordinator.assertTenantContextCorrelationId(contextCorrelationId)
    const tenantId = this.tenantSessionCoordinator.getTenantIdForContextCorrelationId(contextCorrelationId)

    // TODO: maybe we can look at not having to retrieve the tenant record if there's already a context available.
    const tenantRecord = await this.tenantRecordService.getTenantById(this.rootAgentContext, tenantId)
    const shouldUpdate = !isStorageUpToDate(tenantRecord.storageVersion)

    // If the tenant storage is not up to date, and autoUpdate is disabled we throw an error
    if (shouldUpdate && !this.rootAgentContext.config.autoUpdateStorageOnStartup) {
      throw new CredoError(
        `Current agent storage for tenant ${tenantRecord.id} is not up to date. To prevent the tenant state from getting corrupted the tenant initialization is aborted. Make sure to update the tenant storage (currently at ${tenantRecord.storageVersion}) to the latest version (${UpdateAssistant.frameworkStorageVersion}). You can also downgrade your version of Credo.`
      )
    }

    const agentContext = await this.tenantSessionCoordinator.getContextForSession(tenantRecord, {
      provisionContext,
      runInMutex: shouldUpdate ? (agentContext) => this._updateTenantStorage(tenantRecord, agentContext) : undefined,
    })

    this.logger.debug(`Created tenant agent context for context correlation id '${contextCorrelationId}'`)

    return agentContext
  }

  public async getContextForInboundMessage(inboundMessage: unknown, options?: { contextCorrelationId?: string }) {
    this.logger.debug('Getting context for inbound message in tenant agent context provider', {
      contextCorrelationId: options?.contextCorrelationId,
    })

    // TODO: what if context is for root agent context?
    let tenantId =
      options?.contextCorrelationId &&
      this.tenantSessionCoordinator.isTenantContextCorrelationId(options.contextCorrelationId)
        ? this.tenantSessionCoordinator.getTenantIdForContextCorrelationId(options.contextCorrelationId)
        : undefined
    let recipientKeys: Kms.PublicJwk[] = []

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
      throw new CredoError("Couldn't determine tenant id for inbound message. Unable to create context")
    }

    const contextCorrelationId = this.tenantSessionCoordinator.getContextCorrelationIdForTenantId(tenantId)
    const agentContext = await this.getAgentContextForContextCorrelationId(contextCorrelationId)

    return agentContext
  }

  public async endSessionForAgentContext(agentContext: AgentContext) {
    await this.tenantSessionCoordinator.endAgentContextSession(agentContext)
  }

  public async deleteAgentContext(agentContext: AgentContext): Promise<void> {
    await this.tenantSessionCoordinator.deleteAgentContext(agentContext)
  }

  private getRecipientKeysFromEncryptedMessage(jwe: DidCommEncryptedMessage): Kms.PublicJwk[] {
    const jweProtected = JsonEncoder.fromBase64(jwe.protected)
    if (!Array.isArray(jweProtected.recipients)) return []

    const recipientKeys: Kms.PublicJwk[] = []

    for (const recipient of jweProtected.recipients) {
      // Check if recipient.header.kid is a string
      if (isJsonObject(recipient) && isJsonObject(recipient.header) && typeof recipient.header.kid === 'string') {
        // This won't work with other key types, we should detect what the encoding is of kid, and based on that
        // determine how we extract the key from the message
        const publicJwk = Kms.PublicJwk.fromPublicKey({
          crv: 'Ed25519',
          kty: 'OKP',
          publicKey: TypedArrayEncoder.fromBase58(recipient.header.kid),
        })

        recipientKeys.push(publicJwk)
      }
    }

    return recipientKeys
  }

  private async registerRecipientKeyForTenant(tenantId: string, recipientKey: Kms.PublicJwk) {
    this.logger.debug(`Registering recipient key ${recipientKey.fingerprint} for tenant ${tenantId}`)
    const tenantRecord = await this.tenantRecordService.getTenantById(this.rootAgentContext, tenantId)
    await this.tenantRecordService.addTenantRoutingRecord(this.rootAgentContext, tenantRecord.id, recipientKey)
  }

  private listenForRoutingKeyCreatedEvents() {
    this.logger.debug('Listening for routing key created events in tenant agent context provider')
    this.eventEmitter.on<DidCommRoutingCreatedEvent>(DidCommRoutingEventTypes.RoutingCreatedEvent, async (event) => {
      const contextCorrelationId = event.metadata.contextCorrelationId
      const recipientKey = event.payload.routing.recipientKey

      // We don't want to register the key if it's for the root agent context
      if (contextCorrelationId === this.rootAgentContext.contextCorrelationId) return

      this.tenantSessionCoordinator.assertTenantContextCorrelationId(contextCorrelationId)

      this.logger.debug(
        `Received routing key created event for tenant context ${contextCorrelationId}, registering recipient key ${recipientKey.fingerprint} in base wallet`
      )
      await this.registerRecipientKeyForTenant(
        this.tenantSessionCoordinator.getTenantIdForContextCorrelationId(contextCorrelationId),
        recipientKey
      )
    })
  }

  /**
   * Method to allow updating the tenant storage, this method can be called from the TenantsApi
   * to update the storage for a tenant manually
   */
  public async updateTenantStorage(tenantRecord: TenantRecord, updateOptions?: UpdateAssistantUpdateOptions) {
    const agentContext = await this.tenantSessionCoordinator.getContextForSession(tenantRecord, {
      // runInMutex allows us to run the updateTenantStorage method in a mutex lock
      // prevent other sessions from being started while the update is in progress
      runInMutex: (agentContext) => this._updateTenantStorage(tenantRecord, agentContext, updateOptions),
    })

    // End sesion afterwards
    await agentContext.endSession()
  }

  /**
   * Handle the case where the tenant storage is outdated. If auto-update is disabled we will throw an error
   * and not update the storage. If auto-update is enabled we will update the storage.
   *
   * When this method is called we can be sure that we are in the mutex runExclusive lock and thus other sessions
   * will not be able to open a session for this tenant until we're done.
   *
   * NOTE: We don't support multi-instance locking for now. That means you can only have a single instance open and
   * it will prevent multiple processes from updating the tenant storage at the same time. However if multi-instances
   * are used, we can't prevent multiple instances from updating the tenant storage at the same time.
   * In the future we can make the tenantSessionCoordinator an interface and allowing a instance-tenant-lock as well
   * as an tenant-lock (across all instances)
   */
  private async _updateTenantStorage(
    tenantRecord: TenantRecord,
    agentContext: AgentContext,
    updateOptions?: UpdateAssistantUpdateOptions
  ) {
    try {
      // Update the tenant storage
      const tenantAgent = new TenantAgent(agentContext)
      const updateAssistant = new UpdateAssistant(tenantAgent)
      await updateAssistant.initialize()
      await updateAssistant.update(updateOptions)

      // Update the storage version in the tenant record
      tenantRecord.storageVersion = await updateAssistant.getCurrentAgentStorageVersion()
      const tenantRecordService = this.rootAgentContext.dependencyManager.resolve(TenantRecordService)
      await tenantRecordService.updateTenant(this.rootAgentContext, tenantRecord)
    } catch (error) {
      this.logger.error(`Error occurred while updating tenant storage for tenant ${tenantRecord.id}`, error)
      throw error
    }
  }
}
