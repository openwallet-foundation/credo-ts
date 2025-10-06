import { CredoError } from '@credo-ts/core'
import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DidCommMediationRecipientModuleConfigOptions } from './DidCommMediationRecipientModuleConfig'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommConnectionsApi } from '../connections'
import { DidCommOutOfBandApi } from '../oob'
import { DidCommMediationRecipientApi } from './DidCommMediationRecipientApi'
import { DidCommMediationRecipientModuleConfig } from './DidCommMediationRecipientModuleConfig'
import { DidCommMediationRole } from './models'
import { DidCommMediationRepository } from './repository'
import { DidCommMediationRecipientService, DidCommRoutingService } from './services'

export class DidCommMediationRecipientModule implements Module {
  public readonly config: DidCommMediationRecipientModuleConfig
  public readonly api = DidCommMediationRecipientApi

  public constructor(config?: DidCommMediationRecipientModuleConfigOptions) {
    this.config = new DidCommMediationRecipientModuleConfig(config)
  }

  /**
   * Registers the dependencies of the mediator recipient module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommMediationRecipientModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidCommMediationRecipientService)
    dependencyManager.registerSingleton(DidCommRoutingService)

    // Repositories
    dependencyManager.registerSingleton(DidCommMediationRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [DidCommMediationRole.Recipient],
      })
    )
  }

  public async onCloseContext(agentContext: AgentContext): Promise<void> {
    // Q: Can we also just call stop for non-defult context?
    if (!agentContext.isRootAgentContext) return

    const mediationRecipientApi = agentContext.dependencyManager.resolve(DidCommMediationRecipientApi)
    await mediationRecipientApi.stopMessagePickup()
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // We only support mediation config for the root agent context
    if (!agentContext.isRootAgentContext) return

    const mediationRecipientApi = agentContext.dependencyManager.resolve(DidCommMediationRecipientApi)

    // Connect to mediator through provided invitation if provided in config
    // Also requests mediation ans sets as default mediator
    if (this.config.mediatorInvitationUrl) {
      agentContext.config.logger.debug('Provision mediation with invitation', {
        mediatorInvitationUrl: this.config.mediatorInvitationUrl,
      })
      const mediationConnection = await this.getMediationConnection(agentContext, this.config.mediatorInvitationUrl)
      await mediationRecipientApi.provision(mediationConnection)
    }

    // Poll for messages from mediator
    const defaultMediator = await mediationRecipientApi.findDefaultMediator()
    if (defaultMediator) {
      mediationRecipientApi.initiateMessagePickup(defaultMediator).catch((error) => {
        agentContext.config.logger.warn(`Error initiating message pickup with mediator ${defaultMediator.id}`, {
          error,
        })
      })
    }
  }

  protected async getMediationConnection(agentContext: AgentContext, mediatorInvitationUrl: string) {
    const oobApi = agentContext.dependencyManager.resolve(DidCommOutOfBandApi)
    const connectionsApi = agentContext.dependencyManager.resolve(DidCommConnectionsApi)
    const mediationRecipientApi = agentContext.dependencyManager.resolve(DidCommMediationRecipientApi)

    const outOfBandInvitation = await oobApi.parseInvitation(mediatorInvitationUrl)
    const outOfBandRecord = await oobApi.findByReceivedInvitationId(outOfBandInvitation.id)
    const [connection] = outOfBandRecord ? await connectionsApi.findAllByOutOfBandId(outOfBandRecord.id) : []

    if (!connection) {
      agentContext.config.logger.debug('Mediation connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await mediationRecipientApi.getRouting({ useDefaultMediator: false })

      agentContext.config.logger.debug('Routing created', routing)
      const { connectionRecord: newConnection } = await oobApi.receiveInvitation(outOfBandInvitation, {
        label: '',
        routing,
      })
      agentContext.config.logger.debug('Mediation invitation processed', { outOfBandInvitation })

      if (!newConnection) {
        throw new CredoError('No connection record to provision mediation.')
      }

      return connectionsApi.returnWhenIsConnected(newConnection.id)
    }

    if (!connection.isReady) {
      return connectionsApi.returnWhenIsConnected(connection.id)
    }

    return connection
  }
}
