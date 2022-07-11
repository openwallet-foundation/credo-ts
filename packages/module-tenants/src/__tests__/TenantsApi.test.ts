import { Agent, AgentContext, InjectionSymbols } from '@aries-framework/core'

import { agentDependencies, getAgentConfig, getAgentContext, mockFunction } from '../../../core/tests/helpers'
import { TenantAgent } from '../TenantAgent'
import { TenantsApi } from '../TenantsApi'
import { TenantAgentContextProvider } from '../context/TenantAgentContextProvider'
import { TenantRecord } from '../repository'
import { TenantService } from '../services/TenantService'

jest.mock('../services/TenantService')
const TenantServiceMock = TenantService as jest.Mock<TenantService>

jest.mock('../context/TenantAgentContextProvider')
const AgentContextProviderMock = TenantAgentContextProvider as jest.Mock<TenantAgentContextProvider>

const tenantService = new TenantServiceMock()
const agentContextProvider = new AgentContextProviderMock()
const agentConfig = getAgentConfig('TenantsApi')
const rootAgent = new Agent(agentConfig, agentDependencies)
rootAgent.dependencyManager.registerInstance(InjectionSymbols.AgentContextProvider, agentContextProvider)

const tenantsApi = new TenantsApi(tenantService, rootAgent.context, agentContextProvider, agentConfig.logger)

describe('TenantsApi', () => {
  describe('getTenantAgent', () => {
    test('gets context from agent context provider and initializes tenant agent instance', async () => {
      const tenantDependencyManager = rootAgent.dependencyManager.createChild()
      const tenantAgentContext = getAgentContext({
        contextCorrelationId: 'tenant-id',
        dependencyManager: tenantDependencyManager,
        agentConfig: agentConfig.extend({
          label: 'tenant-agent',
          walletConfig: {
            id: 'Wallet: TenantsApi: tenant-id',
            key: 'Wallet: TenantsApi: tenant-id',
          },
        }),
      })
      tenantDependencyManager.registerInstance(AgentContext, tenantAgentContext)

      mockFunction(agentContextProvider.getAgentContextForContextCorrelationId).mockResolvedValue(tenantAgentContext)

      const tenantAgent = await tenantsApi.getTenantAgent({ tenantId: 'tenant-id' })

      expect(tenantAgent.isInitialized).toBe(true)
      expect(tenantAgent.wallet.walletConfig).toEqual({
        id: 'Wallet: TenantsApi: tenant-id',
        key: 'Wallet: TenantsApi: tenant-id',
      })

      expect(agentContextProvider.getAgentContextForContextCorrelationId).toBeCalledWith('tenant-id')
      expect(tenantAgent).toBeInstanceOf(TenantAgent)
      expect(tenantAgent.context).toBe(tenantAgentContext)

      await tenantAgent.wallet.delete()
      await tenantAgent.destroy()
    })
  })

  describe('withTenantAgent', () => {
    test('gets context from agent context provider and initializes tenant agent instance', async () => {
      expect.assertions(6)

      const tenantDependencyManager = rootAgent.dependencyManager.createChild()
      const tenantAgentContext = getAgentContext({
        contextCorrelationId: 'tenant-id',
        dependencyManager: tenantDependencyManager,
        agentConfig: agentConfig.extend({
          label: 'tenant-agent',
          walletConfig: {
            id: 'Wallet: TenantsApi: tenant-id',
            key: 'Wallet: TenantsApi: tenant-id',
          },
        }),
      })
      tenantDependencyManager.registerInstance(AgentContext, tenantAgentContext)

      mockFunction(agentContextProvider.getAgentContextForContextCorrelationId).mockResolvedValue(tenantAgentContext)

      let destroySpy: jest.SpyInstance | undefined = undefined
      await tenantsApi.withTenantAgent({ tenantId: 'tenant-id' }, async (tenantAgent) => {
        destroySpy = jest.spyOn(tenantAgent, 'destroy')
        expect(tenantAgent.isInitialized).toBe(true)
        expect(tenantAgent.wallet.walletConfig).toEqual({
          id: 'Wallet: TenantsApi: tenant-id',
          key: 'Wallet: TenantsApi: tenant-id',
        })

        expect(agentContextProvider.getAgentContextForContextCorrelationId).toBeCalledWith('tenant-id')
        expect(tenantAgent).toBeInstanceOf(TenantAgent)
        expect(tenantAgent.context).toBe(tenantAgentContext)

        await tenantAgent.wallet.delete()
      })

      expect(destroySpy).toHaveBeenCalled()
    })

    test('destroy is called even if the tenant agent callback throws an error', async () => {
      expect.assertions(7)

      const tenantDependencyManager = rootAgent.dependencyManager.createChild()
      const tenantAgentContext = getAgentContext({
        contextCorrelationId: 'tenant-id',
        dependencyManager: tenantDependencyManager,
        agentConfig: agentConfig.extend({
          label: 'tenant-agent',
          walletConfig: {
            id: 'Wallet: TenantsApi: tenant-id',
            key: 'Wallet: TenantsApi: tenant-id',
          },
        }),
      })
      tenantDependencyManager.registerInstance(AgentContext, tenantAgentContext)

      mockFunction(agentContextProvider.getAgentContextForContextCorrelationId).mockResolvedValue(tenantAgentContext)

      let destroySpy: jest.SpyInstance | undefined = undefined
      await expect(
        tenantsApi.withTenantAgent({ tenantId: 'tenant-id' }, async (tenantAgent) => {
          destroySpy = jest.spyOn(tenantAgent, 'destroy')
          expect(tenantAgent.isInitialized).toBe(true)
          expect(tenantAgent.wallet.walletConfig).toEqual({
            id: 'Wallet: TenantsApi: tenant-id',
            key: 'Wallet: TenantsApi: tenant-id',
          })

          expect(agentContextProvider.getAgentContextForContextCorrelationId).toBeCalledWith('tenant-id')
          expect(tenantAgent).toBeInstanceOf(TenantAgent)
          expect(tenantAgent.context).toBe(tenantAgentContext)

          await tenantAgent.wallet.delete()

          throw new Error('Uh oh something went wrong')
        })
      ).rejects.toThrow('Uh oh something went wrong')

      // destroy should have been called
      expect(destroySpy).toHaveBeenCalled()
    })
  })

  describe('createTenant', () => {
    test('create tenant in the service and get the tenant agent to initialize', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant-id',
        config: {
          label: 'test',
          walletConfig: {
            id: 'Wallet: TenantsApi: tenant-id',
            key: 'Wallet: TenantsApi: tenant-id',
          },
        },
      })

      const tenantAgentMock = {
        wallet: {
          delete: jest.fn(),
        },
        destroy: jest.fn(),
      } as unknown as TenantAgent

      mockFunction(tenantService.createTenant).mockResolvedValue(tenantRecord)
      const getTenantAgentSpy = jest.spyOn(tenantsApi, 'getTenantAgent').mockResolvedValue(tenantAgentMock)

      const createdTenantRecord = await tenantsApi.createTenant({
        config: {
          label: 'test',
        },
      })

      expect(getTenantAgentSpy).toHaveBeenCalledWith({ tenantId: 'tenant-id' })
      expect(createdTenantRecord).toBe(tenantRecord)
      expect(tenantAgentMock.destroy).toHaveBeenCalled()
      expect(tenantService.createTenant).toHaveBeenCalledWith(rootAgent.context, {
        label: 'test',
      })
    })
  })

  describe('getTenantById', () => {
    test('calls get tenant by id on tenant service', async () => {
      const tenantRecord = jest.fn() as unknown as TenantRecord
      mockFunction(tenantService.getTenantById).mockResolvedValue(tenantRecord)

      const actualTenantRecord = await tenantsApi.getTenantById('tenant-id')

      expect(tenantService.getTenantById).toHaveBeenCalledWith(rootAgent.context, 'tenant-id')
      expect(actualTenantRecord).toBe(tenantRecord)
    })
  })

  describe('deleteTenantById', () => {
    test('deletes the tenant and removes the wallet', async () => {
      const tenantAgentMock = {
        wallet: {
          delete: jest.fn(),
        },
        destroy: jest.fn(),
      } as unknown as TenantAgent
      const getTenantAgentSpy = jest.spyOn(tenantsApi, 'getTenantAgent').mockResolvedValue(tenantAgentMock)

      await tenantsApi.deleteTenantById('tenant-id')

      expect(getTenantAgentSpy).toHaveBeenCalledWith({ tenantId: 'tenant-id' })
      expect(tenantAgentMock.wallet.delete).toHaveBeenCalled()
      expect(tenantAgentMock.destroy).toHaveBeenCalled()
      expect(tenantService.deleteTenantById).toHaveBeenCalledWith(rootAgent.context, 'tenant-id')
    })
  })
})
