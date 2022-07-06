import type { DependencyManager } from '../../plugins'
import type { IndyPoolConfig } from './IndyPool'
import type { CredentialDefinitionTemplate, SchemaTemplate } from './services'
import type { NymRole } from 'indy-sdk'

import { AgentContext } from '../../agent'
import { AriesFrameworkError } from '../../error'
import { injectable, module } from '../../plugins'

import { IndyLedgerService, IndyPoolService } from './services'

@module()
@injectable()
export class LedgerModule {
  private ledgerService: IndyLedgerService
  private agentContext: AgentContext

  public constructor(ledgerService: IndyLedgerService, agentContext: AgentContext) {
    this.ledgerService = ledgerService
    this.agentContext = agentContext
  }

  public setPools(poolConfigs: IndyPoolConfig[]) {
    return this.ledgerService.setPools(poolConfigs)
  }

  /**
   * Connect to all the ledger pools
   */
  public async connectToPools() {
    await this.ledgerService.connectToPools()
  }

  public async registerPublicDid(did: string, verkey: string, alias: string, role?: NymRole) {
    const myPublicDid = this.agentContext.wallet.publicDid?.did

    if (!myPublicDid) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerPublicDid(this.agentContext, myPublicDid, did, verkey, alias, role)
  }

  public async getPublicDid(did: string) {
    return this.ledgerService.getPublicDid(this.agentContext, did)
  }

  public async registerSchema(schema: SchemaTemplate) {
    const did = this.agentContext.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerSchema(this.agentContext, did, schema)
  }

  public async getSchema(id: string) {
    return this.ledgerService.getSchema(this.agentContext, id)
  }

  public async registerCredentialDefinition(
    credentialDefinitionTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'>
  ) {
    const did = this.agentContext.wallet.publicDid?.did

    if (!did) {
      throw new AriesFrameworkError('Agent has no public DID.')
    }

    return this.ledgerService.registerCredentialDefinition(this.agentContext, did, {
      ...credentialDefinitionTemplate,
      signatureType: 'CL',
    })
  }

  public async getCredentialDefinition(id: string) {
    return this.ledgerService.getCredentialDefinition(this.agentContext, id)
  }

  public async getRevocationRegistryDefinition(revocationRegistryDefinitionId: string) {
    return this.ledgerService.getRevocationRegistryDefinition(this.agentContext, revocationRegistryDefinitionId)
  }

  public async getRevocationRegistryDelta(
    revocationRegistryDefinitionId: string,
    fromSeconds = 0,
    toSeconds = new Date().getTime()
  ) {
    return this.ledgerService.getRevocationRegistryDelta(
      this.agentContext,
      revocationRegistryDefinitionId,
      fromSeconds,
      toSeconds
    )
  }

  /**
   * Registers the dependencies of the ledger module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(LedgerModule)

    // Services
    dependencyManager.registerSingleton(IndyLedgerService)
    dependencyManager.registerSingleton(IndyPoolService)
  }
}
