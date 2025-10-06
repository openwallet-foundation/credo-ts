import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import type { DrizzleStorageModuleConfigOptions } from './DrizzleStorageModuleConfig'

import { CredoError, InjectionSymbols, StorageUpdateService } from '@credo-ts/core'

import { eq } from 'drizzle-orm'
import { isDrizzlePostgresDatabase, isDrizzleSqliteDatabase } from './DrizzleDatabase'
import { DrizzleStorageModuleConfig } from './DrizzleStorageModuleConfig'
import { context as postgresContext } from './core/postgres'
import { context as sqliteContext } from './core/sqlite'
import { CredoDrizzleStorageError } from './error'
import { DrizzleStorageService } from './storage'

export class DrizzleStorageModule implements Module {
  public readonly config: DrizzleStorageModuleConfig

  public constructor(config: DrizzleStorageModuleConfigOptions) {
    this.config = new DrizzleStorageModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(DrizzleStorageModuleConfig, this.config)

    if (dependencyManager.isRegistered(InjectionSymbols.StorageService)) {
      throw new CredoError(
        'Unable to register DrizzleStorageService. There is an instance of StorageService already registered'
      )
    }
    dependencyManager.registerSingleton(InjectionSymbols.StorageService, DrizzleStorageService)
  }

  public async onInitializeContext(agentContext: AgentContext): Promise<void> {
    // For the root agent context we don't call provision, we should probably change that
    // but this is because agent.initialize doesn't differantiate between create and open
    // So we need to check basically when we start the agent if this is a new agent
    // and if so, set the framework storage version. This is a bit inefficient, as we will
    // again fetch the record after the module has been initialized, but probably something
    // we can improve with caching.
    if (agentContext.isRootAgentContext) {
      const storageUpdateService = agentContext.resolve(StorageUpdateService)

      // Previously if we didn't have a storage version record yet it meant we assumed you
      // were on 0.1 before the record was added, but since this module is introduced in 0.6
      // we can be sure that's not the case.
      if (!(await storageUpdateService.hasStorageVersionRecord(agentContext))) {
        await this.createNewContextInDatabase(agentContext)
      }
    }
  }

  public async onProvisionContext(agentContext: AgentContext): Promise<void> {
    // This method is never called for root agent context
    // but to be sure if that changes in the future
    if (agentContext.isRootAgentContext) return

    await this.createNewContextInDatabase(agentContext)
  }

  public async onDeleteContext(agentContext: AgentContext): Promise<void> {
    // If it's the root agent context, we want to delete all the tenants as well
    if (agentContext.isRootAgentContext) {
      // Do we want to allow this? It can be quite impactfull
      await this.deleteContextQuery()
    } else {
      await this.deleteContextQuery().where(eq(sqliteContext.contextCorrelationId, agentContext.contextCorrelationId))
    }
  }

  private deleteContextQuery() {
    // TODO: we could probably add some extra abstraction here.
    if (isDrizzlePostgresDatabase(this.config.database)) {
      return this.config.database.delete(postgresContext)
    }

    if (isDrizzleSqliteDatabase(this.config.database)) {
      return this.config.database.delete(sqliteContext)
    }

    throw new CredoDrizzleStorageError(
      'Unable to delete context. Database must be instance of postgres or sqlite database.'
    )
  }

  private async createNewContextInDatabase(agentContext: AgentContext) {
    // For new contexts, we need to set the storage version
    const storageUpdateService = agentContext.resolve(StorageUpdateService)

    if (isDrizzlePostgresDatabase(this.config.database)) {
      // Create a new context record. This is mostly used to allow deleting a context and
      // cascade delete all other records.
      await this.config.database
        .insert(postgresContext)
        .values({
          contextCorrelationId: agentContext.contextCorrelationId,
        })
        .onConflictDoNothing()
    } else if (isDrizzleSqliteDatabase(this.config.database)) {
      await this.config.database
        .insert(sqliteContext)
        .values({
          contextCorrelationId: agentContext.contextCorrelationId,
        })
        .onConflictDoNothing()
    } else {
      throw new CredoDrizzleStorageError(
        'Unable to provision context. Database must be instance of postgres or sqlite database.'
      )
    }

    await storageUpdateService.setCurrentStorageVersion(agentContext, StorageUpdateService.frameworkStorageVersion)
  }
}
