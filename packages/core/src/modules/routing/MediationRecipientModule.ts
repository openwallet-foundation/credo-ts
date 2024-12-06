import type { MediationRecipientModuleConfigOptions } from './MediationRecipientModuleConfig'
import type { AgentContext } from '../../agent'
import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'

import { Protocol } from '../../agent/models'
import { CredoError } from '../../error'
import { ConnectionsApi } from '../connections'
import { OutOfBandApi } from '../oob'

import { MediationRecipientApi } from './MediationRecipientApi'
import { MediationRecipientModuleConfig } from './MediationRecipientModuleConfig'
import { MediationRole } from './models'
import { MediationRepository } from './repository'
import { MediationRecipientService, RoutingService } from './services'

export class MediationRecipientModule implements Module {
  public readonly config: MediationRecipientModuleConfig
  public readonly api = MediationRecipientApi

  public constructor(config?: MediationRecipientModuleConfigOptions) {
    this.config = new MediationRecipientModuleConfig(config)
  }

  /**
   * Registers the dependencies of the mediator recipient module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Config
    dependencyManager.registerInstance(MediationRecipientModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MediationRecipientService)
    dependencyManager.registerSingleton(RoutingService)

    // Repositories
    dependencyManager.registerSingleton(MediationRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [MediationRole.Recipient],
      })
    )
  }

  public async onCloseContext(agentContext: AgentContext): Promise<void> {
    // Q: Can we also just call stop for non-defult context?
    if (agentContext.contextCorrelationId !== 'default') return

    const mediationRecipientApi = agentContext.dependencyManager.resolve(MediationRecipientApi)
    await mediationRecipientApi.stopMessagePickup()
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // We only support mediation config for the root agent context
    if (agentContext.contextCorrelationId !== 'default') return

    const mediationRecipientApi = agentContext.dependencyManager.resolve(MediationRecipientApi)

    // Connect to mediator through provided invitation if provided in config
    // Also requests mediation ans sets as default mediator
    if (this.config.mediatorInvitationUrl) {
      agentContext.config.logger.debug('Provision mediation with invitation', {
        mediatorInvitationUrl: this.config.mediatorInvitationUrl,
      })
      const mediationConnection = await this.getMediationConnection(agentContext, this.config.mediatorInvitationUrl)
      await mediationRecipientApi.provision(mediationConnection)
    }

    await mediationRecipientApi.initialize()
  }

  protected async getMediationConnection(agentContext: AgentContext, mediatorInvitationUrl: string) {
    const oobApi = agentContext.dependencyManager.resolve(OutOfBandApi)
    const connectionsApi = agentContext.dependencyManager.resolve(ConnectionsApi)
    const mediationRecipientApi = agentContext.dependencyManager.resolve(MediationRecipientApi)

    const outOfBandInvitation = await oobApi.parseInvitation(mediatorInvitationUrl)
    const outOfBandRecord = await oobApi.findByReceivedInvitationId(outOfBandInvitation.id)
    const [connection] = outOfBandRecord ? await connectionsApi.findAllByOutOfBandId(outOfBandRecord.id) : []

    if (!connection) {
      agentContext.config.logger.debug('Mediation connection does not exist, creating connection')
      // We don't want to use the current default mediator when connecting to another mediator
      const routing = await mediationRecipientApi.getRouting({ useDefaultMediator: false })

      agentContext.config.logger.debug('Routing created', routing)
      const { connectionRecord: newConnection } = await oobApi.receiveInvitation(outOfBandInvitation, {
        routing,
      })
      agentContext.config.logger.debug(`Mediation invitation processed`, { outOfBandInvitation })

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
