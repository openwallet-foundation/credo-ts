import type { Module } from '../../plugins'

import { getAgentConfig } from '../../../tests/helpers'
import { BasicMessagesModule } from '../../modules/basic-messages'
import { CacheModule } from '../../modules/cache'
import { ConnectionsModule } from '../../modules/connections'
import { CredentialsModule } from '../../modules/credentials'
import { DidsModule } from '../../modules/dids'
import { DiscoverFeaturesModule } from '../../modules/discover-features'
import { GenericRecordsModule } from '../../modules/generic-records'
import { OutOfBandModule } from '../../modules/oob'
import { ProofsModule } from '../../modules/proofs'
import { MediatorModule, RecipientModule } from '../../modules/routing'
import { W3cVcModule } from '../../modules/vc'
import { DependencyManager, injectable } from '../../plugins'
import { WalletModule } from '../../wallet'
import { extendModulesWithDefaultModules, getAgentApi } from '../AgentModules'

const agentConfig = getAgentConfig('AgentModules Test')

@injectable()
class MyApi {}

class MyModuleWithApi implements Module {
  public api = MyApi
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerContextScoped(MyApi)
  }
}

class MyModuleWithoutApi implements Module {
  public register() {
    // nothing to register
  }
}

describe('AgentModules', () => {
  describe('getAgentApi', () => {
    test('returns object with all api instances for modules with public api in dependency manager', () => {
      const dependencyManager = new DependencyManager()

      dependencyManager.registerModules({
        withApi: new MyModuleWithApi(),
        withoutApi: new MyModuleWithoutApi(),
      })

      const api = getAgentApi(dependencyManager)

      expect(api).toEqual({
        withApi: expect.any(MyApi),
      })
    })
  })

  describe('extendModulesWithDefaultModules', () => {
    test('returns default modules if no modules were provided', () => {
      const extendedModules = extendModulesWithDefaultModules(agentConfig)

      expect(extendedModules).toEqual({
        connections: expect.any(ConnectionsModule),
        credentials: expect.any(CredentialsModule),
        proofs: expect.any(ProofsModule),
        mediator: expect.any(MediatorModule),
        mediationRecipient: expect.any(RecipientModule),
        basicMessages: expect.any(BasicMessagesModule),
        genericRecords: expect.any(GenericRecordsModule),
        discovery: expect.any(DiscoverFeaturesModule),
        dids: expect.any(DidsModule),
        wallet: expect.any(WalletModule),
        oob: expect.any(OutOfBandModule),
        w3cVc: expect.any(W3cVcModule),
        cache: expect.any(CacheModule),
      })
    })

    test('returns custom and default modules if custom modules are provided', () => {
      const myModule = new MyModuleWithApi()
      const extendedModules = extendModulesWithDefaultModules(agentConfig, {
        myModule,
      })

      expect(extendedModules).toEqual({
        connections: expect.any(ConnectionsModule),
        credentials: expect.any(CredentialsModule),
        proofs: expect.any(ProofsModule),
        mediator: expect.any(MediatorModule),
        mediationRecipient: expect.any(RecipientModule),
        basicMessages: expect.any(BasicMessagesModule),
        genericRecords: expect.any(GenericRecordsModule),
        discovery: expect.any(DiscoverFeaturesModule),
        dids: expect.any(DidsModule),
        wallet: expect.any(WalletModule),
        oob: expect.any(OutOfBandModule),
        w3cVc: expect.any(W3cVcModule),
        cache: expect.any(CacheModule),
        myModule,
      })
    })

    test('does not override default module if provided as custom module', () => {
      const myModule = new MyModuleWithApi()
      const connections = new ConnectionsModule()
      const extendedModules = extendModulesWithDefaultModules(agentConfig, {
        myModule,
        connections,
      })

      expect(extendedModules).toEqual({
        connections: connections,
        credentials: expect.any(CredentialsModule),
        proofs: expect.any(ProofsModule),
        mediator: expect.any(MediatorModule),
        mediationRecipient: expect.any(RecipientModule),
        basicMessages: expect.any(BasicMessagesModule),
        genericRecords: expect.any(GenericRecordsModule),
        discovery: expect.any(DiscoverFeaturesModule),
        dids: expect.any(DidsModule),
        wallet: expect.any(WalletModule),
        oob: expect.any(OutOfBandModule),
        w3cVc: expect.any(W3cVcModule),
        cache: expect.any(CacheModule),
        myModule,
      })
    })
  })
})
