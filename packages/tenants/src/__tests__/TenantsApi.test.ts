import { Agent, AgentContext, InjectionSymbols } from '@credo-ts/core'

import { getAgentContext, getAgentOptions, mockFunction } from '../../../core/tests'
import { TenantAgent } from '../TenantAgent'
import { TenantsApi } from '../TenantsApi'
import { TenantAgentContextProvider } from '../context/TenantAgentContextProvider'
import { TenantRecord } from '../repository'
import { TenantRecordService } from '../services/TenantRecordService'

jest.mock('../services/TenantRecordService')
const TenantRecordServiceMock = TenantRecordService as jest.Mock<TenantRecordService>

jest.mock('../context/TenantAgentContextProvider')
const AgentContextProviderMock = TenantAgentContextProvider as jest.Mock<TenantAgentContextProvider>

const tenantRecordService = new TenantRecordServiceMock()
const agentContextProvider = new AgentContextProviderMock()
agentContextProvider.getContextCorrelationIdForTenantId = (tenantId) => `tenant-${tenantId}`
const agentOptions = getAgentOptions('TenantsApi', undefined, { autoUpdateStorageOnStartup: true })
const rootAgent = new Agent(agentOptions)
rootAgent.dependencyManager.registerInstance(InjectionSymbols.AgentContextProvider, agentContextProvider)

const tenantsApi = new TenantsApi(tenantRecordService, rootAgent.context, agentContextProvider, rootAgent.config.logger)

describe('TenantsApi', () => {
  describe('getTenantAgent', () => {
    test('gets context from agent context provider and initializes tenant agent instance', async () => {
      const tenantDependencyManager = rootAgent.dependencyManager.createChild()
      const tenantAgentContext = getAgentContext({
        contextCorrelationId: 'tenant-id',
        dependencyManager: tenantDependencyManager,
        agentConfig: rootAgent.config.extend({
          label: 'tenant-agent',
        }),
      })
      tenantDependencyManager.registerInstance(AgentContext, tenantAgentContext)

      mockFunction(agentContextProvider.getAgentContextForContextCorrelationId).mockResolvedValue(tenantAgentContext)

      const tenantAgent = await tenantsApi.getTenantAgent({ tenantId: 'tenant-id' })

      expect(tenantAgent.isInitialized).toBe(true)
      expect(tenantAgent.config.label).toEqual('tenant-agent')

      expect(agentContextProvider.getAgentContextForContextCorrelationId).toHaveBeenCalledWith('tenant-tenant-id', {
        provisionContext: false,
      })
      expect(tenantAgent).toBeInstanceOf(TenantAgent)
      expect(tenantAgent.context).toBe(tenantAgentContext)

      await tenantAgent.endSession()
    })
  })

  describe('withTenantAgent', () => {
    test('gets context from agent context provider and initializes tenant agent instance', async () => {
      expect.assertions(6)

      const tenantDependencyManager = rootAgent.dependencyManager.createChild()
      const tenantAgentContext = getAgentContext({
        contextCorrelationId: 'tenant-id',
        dependencyManager: tenantDependencyManager,
        agentConfig: rootAgent.config.extend({
          label: 'tenant-agent',
        }),
      })
      tenantDependencyManager.registerInstance(AgentContext, tenantAgentContext)

      mockFunction(agentContextProvider.getAgentContextForContextCorrelationId).mockResolvedValue(tenantAgentContext)

      let endSessionSpy: jest.SpyInstance | undefined = undefined
      await tenantsApi.withTenantAgent({ tenantId: 'tenant-id' }, async (tenantAgent) => {
        endSessionSpy = jest.spyOn(tenantAgent, 'endSession')
        expect(tenantAgent.isInitialized).toBe(true)
        expect(tenantAgent.config.label).toEqual('tenant-agent')

        expect(agentContextProvider.getAgentContextForContextCorrelationId).toHaveBeenCalledWith('tenant-tenant-id', {
          provisionContext: false,
        })
        expect(tenantAgent).toBeInstanceOf(TenantAgent)
        expect(tenantAgent.context).toBe(tenantAgentContext)
      })

      expect(endSessionSpy).toHaveBeenCalled()
    })

    test('endSession is called even if the tenant agent callback throws an error', async () => {
      expect.assertions(7)

      const tenantDependencyManager = rootAgent.dependencyManager.createChild()
      const tenantAgentContext = getAgentContext({
        contextCorrelationId: 'tenant-id',
        dependencyManager: tenantDependencyManager,
        agentConfig: rootAgent.config.extend({
          label: 'tenant-agent',
        }),
      })
      tenantDependencyManager.registerInstance(AgentContext, tenantAgentContext)

      mockFunction(agentContextProvider.getAgentContextForContextCorrelationId).mockResolvedValue(tenantAgentContext)

      let endSessionSpy: jest.SpyInstance | undefined = undefined
      await expect(
        tenantsApi.withTenantAgent({ tenantId: 'tenant-id' }, async (tenantAgent) => {
          endSessionSpy = jest.spyOn(tenantAgent, 'endSession')
          expect(tenantAgent.isInitialized).toBe(true)
          expect(tenantAgent.config.label).toEqual('tenant-agent')

          expect(agentContextProvider.getAgentContextForContextCorrelationId).toHaveBeenCalledWith('tenant-tenant-id', {
            provisionContext: false,
          })
          expect(tenantAgent).toBeInstanceOf(TenantAgent)
          expect(tenantAgent.context).toBe(tenantAgentContext)

          throw new Error('Uh oh something went wrong')
        })
      ).rejects.toThrow('Uh oh something went wrong')

      // endSession should have been called
      expect(endSessionSpy).toHaveBeenCalled()
    })
  })

  describe('createTenant', () => {
    test('create tenant in the service and get the tenant agent to initialize', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant-id',
        config: {
          label: 'test',
        },
        storageVersion: '0.5',
      })

      const tenantAgentMock = {
        endSession: jest.fn(),
      } as unknown as TenantAgent

      mockFunction(tenantRecordService.createTenant).mockResolvedValue(tenantRecord)

      // @ts-ignore
      const getTenantAgentSpy = jest.spyOn(tenantsApi, '_getTenantAgent').mockResolvedValue(tenantAgentMock)

      const createdTenantRecord = await tenantsApi.createTenant({
        config: {
          label: 'test',
        },
      })

      expect(getTenantAgentSpy).toHaveBeenCalledWith({ tenantId: 'tenant-id', provisionContext: true })
      expect(createdTenantRecord).toBe(tenantRecord)
      expect(tenantAgentMock.endSession).toHaveBeenCalled()
      expect(tenantRecordService.createTenant).toHaveBeenCalledWith(rootAgent.context, {
        label: 'test',
      })
    })
  })

  describe('getTenantById', () => {
    test('calls get tenant by id on tenant service', async () => {
      const tenantRecord = jest.fn() as unknown as TenantRecord
      mockFunction(tenantRecordService.getTenantById).mockResolvedValue(tenantRecord)

      const actualTenantRecord = await tenantsApi.getTenantById('tenant-id')

      expect(tenantRecordService.getTenantById).toHaveBeenCalledWith(rootAgent.context, 'tenant-id')
      expect(actualTenantRecord).toBe(tenantRecord)
    })
  })

  describe('deleteTenantById', () => {
    test('deletes the tenant and removes the wallet', async () => {
      const tenantAgentMock = {
        endSession: jest.fn(),
        context: {
          dependencyManager: {
            deleteAgentContext: jest.fn(),
          },
        },
      } as unknown as TenantAgent
      const getTenantAgentSpy = jest.spyOn(tenantsApi, 'getTenantAgent').mockResolvedValue(tenantAgentMock)

      await tenantsApi.deleteTenantById('tenant-id')

      expect(getTenantAgentSpy).toHaveBeenCalledWith({ tenantId: 'tenant-id' })
      expect(agentContextProvider.deleteAgentContext).toHaveBeenCalled()
      expect(tenantRecordService.deleteTenantById).toHaveBeenCalledWith(rootAgent.context, 'tenant-id')
    })
  })

  describe('getAllTenants', () => {
    test('calls get all tenants on tenant service', async () => {
      const tenantRecords = jest.fn() as unknown as Array<TenantRecord>
      mockFunction(tenantRecordService.getAllTenants).mockResolvedValue(tenantRecords)

      const actualTenantRecords = await tenantsApi.getAllTenants()

      expect(tenantRecordService.getAllTenants).toHaveBeenCalledWith(rootAgent.context)
      expect(actualTenantRecords).toBe(tenantRecords)
    })
  })
})
