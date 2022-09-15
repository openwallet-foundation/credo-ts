import type { Module } from '../../plugins'

import {
  ConnectionsModule,
  CredentialsModule,
  ProofsModule,
  MediatorModule,
  RecipientModule,
  BasicMessagesModule,
  QuestionAnswerModule,
  LedgerModule,
  DidsModule,
  OutOfBandModule,
} from '../..'
import { getAgentConfig } from '../../../tests/helpers'
import { DiscoverFeaturesModule } from '../../modules/discover-features'
import { GenericRecordsModule } from '../../modules/generic-records'
import { IndyModule } from '../../modules/indy'
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
        questionAnswer: expect.any(QuestionAnswerModule),
        genericRecords: expect.any(GenericRecordsModule),
        ledger: expect.any(LedgerModule),
        discovery: expect.any(DiscoverFeaturesModule),
        dids: expect.any(DidsModule),
        wallet: expect.any(WalletModule),
        oob: expect.any(OutOfBandModule),
        indy: expect.any(IndyModule),
        w3cVc: expect.any(W3cVcModule),
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
        questionAnswer: expect.any(QuestionAnswerModule),
        genericRecords: expect.any(GenericRecordsModule),
        ledger: expect.any(LedgerModule),
        discovery: expect.any(DiscoverFeaturesModule),
        dids: expect.any(DidsModule),
        wallet: expect.any(WalletModule),
        oob: expect.any(OutOfBandModule),
        indy: expect.any(IndyModule),
        w3cVc: expect.any(W3cVcModule),
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
        questionAnswer: expect.any(QuestionAnswerModule),
        genericRecords: expect.any(GenericRecordsModule),
        ledger: expect.any(LedgerModule),
        discovery: expect.any(DiscoverFeaturesModule),
        dids: expect.any(DidsModule),
        wallet: expect.any(WalletModule),
        oob: expect.any(OutOfBandModule),
        indy: expect.any(IndyModule),
        w3cVc: expect.any(W3cVcModule),
        myModule,
      })
    })
  })
})
