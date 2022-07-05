import type { AgentContext } from '@aries-framework/core'

import { Key } from '@aries-framework/core'

import { EventEmitter } from '../../../../core/src/agent/EventEmitter'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { TenantRecord, TenantRoutingRecord } from '../../repository'
import { TenantService } from '../../services/TenantService'
import { TenantAgentContextProvider } from '../TenantAgentContextProvider'
import { TenantSessionCoordinator } from '../TenantSessionCoordinator'

jest.mock('../../../../core/src/agent/EventEmitter')
jest.mock('../../services/TenantService')
jest.mock('../TenantSessionCoordinator')

const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const TenantServiceMock = TenantService as jest.Mock<TenantService>
const TenantSessionCoordinatorMock = TenantSessionCoordinator as jest.Mock<TenantSessionCoordinator>

const tenantService = new TenantServiceMock()
const tenantSessionCoordinator = new TenantSessionCoordinatorMock()

const rootAgentContext = getAgentContext()
const agentConfig = getAgentConfig('TenantAgentContextProvider')
const eventEmitter = new EventEmitterMock()

const tenantAgentContextProvider = new TenantAgentContextProvider(
  tenantService,
  rootAgentContext,
  eventEmitter,
  tenantSessionCoordinator,
  agentConfig.logger
)

const inboundMessage = {
  protected:
    'eyJlbmMiOiJ4Y2hhY2hhMjBwb2x5MTMwNV9pZXRmIiwidHlwIjoiSldNLzEuMCIsImFsZyI6IkF1dGhjcnlwdCIsInJlY2lwaWVudHMiOlt7ImVuY3J5cHRlZF9rZXkiOiIta3AzRlREbzdNTnlqSVlvWkhFdFhzMzRLTlpEODBIc2tEVTcxSVg5ejJpdVphUy1PVHhNc21KUWNCeDN1Y1lVIiwiaGVhZGVyIjp7ImtpZCI6IjdQd0ZrMXB2V2JOTkUyUDRDTFlnWW5jUXJMc0VSRUx2cDZmQVRaTktVZnpXIiwiaXYiOiJBSElTQk94MWhrWk5obkVwWndJNFlWZ09HNnQ3RDhlQiIsInNlbmRlciI6IjRMTnFHWGJ3SGlPU01uQThsV1M3bEpocER6aGY5UUIyYjNPUVZyWkkyeEctWWJkT1BUamR6WWRGamdpbFo4MF95bXhKSHpoWmp1bHhPeEVvek81VUhDQzJ3bnV3MHo3OVRRWjE5MFgzUFI2WWlrSUVIcms2N3A4V09WTT0ifX1dfQ==',
  iv: 'CfsDEiS63uOJRZa-',
  ciphertext:
    'V6V23nNdKSn2a0jqrjQoU8cj6Ks9w9_4eqE0_856hjd_gxYxqT4W0M9sZ5ov1zlOptrBz6wGDK-BoEbOzvgNqHmiUS5h_VvVuEIevpp9xYrCLlNigrXJEtoDGWkVVpYq3i14l5XGMYCu2zTL7QJxHqDrzRAG-5Iqht0FY45u4L471CMvj31XuZps6I_wl-TJWfeZbAS1Knp_dEnElqtbkcctOKjnvaosk2WYaIrQXRiJxk-4URGnmMAQxjSSt5KuzE3LQ_fa_u5PQLC0EaOsg5M9fYBSIB1_090fQ0QTPXLB69pyiFzLmb016vHGIG5nAbqNKS7fmkhxo7iMkOBlR5d5FpCAguXln4Fg4Q4tZgEaPXVkqmayTvLyeJqXa22dbNDhaPGrvjlNimn8moP8qSC0Avoozn4BDdLrSQxs5daYcH0JYhqz7VII2Mrb2gp2LMsQsoy-UrChTZSBeyjWdapqOzMc8yOhKYXwA_du0RfSaPFe8VJyMo4X73LC6-i1QU5xg3fZKiKJWRrTUazLvdNEXm79DV76LxylodY7OeCGH6E2amF1k10VC2eYwNCI3CfXS8uvjDEIQGgsVETCqwclWKxD-AhQEwZFRlNhZjlfbUyOKH8WAoikloN75T2AZiTivzlE5ZvnPUU_z4LJI02z-vpIMEjkHKcgjx0jDFi3VkfLPiOG4P6btZpxjISfZvWcCiebAhs5jAGX2zNjYiPErJx33zOclHYS8KEZB3fdAdpAZKdYlPyAOFpN8r21kn6HPYjm-3NmTqrHAjDIMgt0mJ6AI58XOnoqRWN7Hl1HWhy9qkt0AqRVJZIIoyFefvKRJvotsv9aj1ZGPqnrkR2Hpj7u-K8VOKreIg4kWYyVbAF8Oift9CrqJ4olOOSUOQZ_NL36qGJc1RCR_wRnTWikoRR_o4h4fDZtxTQG9nUgbAoaAumJAbp5mxrYBW6KVZ-Jm9rhdNnRRnvvd1e_uW-X66_9B5g0GM3BmsXK-ARpJP6ZYmpQYiVFjrDxOSrvq1gD3aPi0SCP6mYoNvemGoXFhGTPMTGQvy1RAwY9t_BosZNEMZMfYTzHxWhN55yXd0861uv5nFe_aLKQcdin8QySW-FS0jcExnRostY922fqT5JYPBINqAr59u8gpzX-N9DgczL1WjuKkwyezLrcCR1IaG9gZrEIJxLDRGHvBno6ZkqmLiuAx3LZxgrT5yN2fI7WjO5HHQMVLn7rVF-THmpLNTZmmsoJ2ZU9ZGeAMKBpcfIYIHgKHF1vumr_h2uCbvxlwqigm5A-dSmto0Fv9xewfDhZ5TvE-TKwHpwmb0OG4kZqC3CnMmzh_oSOK0Cc6ovldiVOUvXdVZJiSD9KEFxn1YmDNbsdMDP9GAAWAknFmdBp5x7DCCt6sMjCVuw1hbELAGXusipfdvfb4htSN5FR4k72efenEr0glFtDk7s5EvWTWsBZyv92P5et-70MjTKGtMJaC4uCBL3li3ty397yKKcJly2Fog5N0phqPHPHg_-CGZ8YpkcM_q3Ijcc8db701K2TShiG97AjOdCZCSgK8OGv_UFXxXXxiwrdQOM0Jfg0TCz_ESxQLAlepK4JQplE_kR8k3jDf5nH4SMueobioPfkLQ92lCFXBOCX3ugoJJnnb49CbQfi-49PAHsGaTopLXxZoEdf6kgJ8phFakBoMmbLE1zIV43oVR8T-zZYsr377q6c6LY46PyYusP7CB5wgXbG4nyJZ_zGZHvY_hnbcE2-EuysmzQV4-6rJdLdT8FSyX_Xo-K2ZmX-riFUcKamoFWmO3CDtexn-ZgtAIJpdjAApWHFxZWLI6xx67OgHl8GT2HIs_BdoetFvmj4tJ_Aw8_Mmb9W37B4Esom1Tg3XxxfLqj24s7UlgUwYFblkYtB1L9-9DkNlZZWkYJz-A28WW6OSqIYNw0ASyNDEp3Mwy0SHDUYh10NUmQ4C476QRNmr32Jv_6AiTGj1thibFg_Ewd_kdvvo0E7VL6gktZNh9kIT-EPgFAobR5IpG0_V1dJ7pEQPKN-n7nc6gWgry7kxNIfS4LcbPwVDsUzJiJ4Qlw=',
  tag: 'goWiDaoxy4mHHRnkPiux4Q==',
}

describe('TenantAgentContextProvider', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getAgentContextForContextCorrelationId', () => {
    test('retrieves the tenant and calls tenant session coordinator', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
      })

      const tenantAgentContext = jest.fn() as unknown as AgentContext

      mockFunction(tenantService.getTenantById).mockResolvedValue(tenantRecord)
      mockFunction(tenantSessionCoordinator.getContextForSession).mockResolvedValue(tenantAgentContext)

      const returnedAgentContext = await tenantAgentContextProvider.getAgentContextForContextCorrelationId('tenant1')

      expect(tenantService.getTenantById).toHaveBeenCalledWith(rootAgentContext, 'tenant1')
      expect(tenantSessionCoordinator.getContextForSession).toHaveBeenCalledWith(tenantRecord)
      expect(returnedAgentContext).toBe(tenantAgentContext)
    })
  })

  describe('getContextForInboundMessage', () => {
    test('directly calls get agent context if tenant id has been provided in the contextCorrelationId', async () => {
      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
      })

      const tenantAgentContext = jest.fn() as unknown as AgentContext

      mockFunction(tenantService.getTenantById).mockResolvedValue(tenantRecord)
      mockFunction(tenantSessionCoordinator.getContextForSession).mockResolvedValue(tenantAgentContext)

      const returnedAgentContext = await tenantAgentContextProvider.getContextForInboundMessage(
        {},
        { contextCorrelationId: 'tenant1' }
      )

      expect(tenantService.getTenantById).toHaveBeenCalledWith(rootAgentContext, 'tenant1')
      expect(tenantSessionCoordinator.getContextForSession).toHaveBeenCalledWith(tenantRecord)
      expect(returnedAgentContext).toBe(tenantAgentContext)
      expect(tenantService.findTenantRoutingRecordByRecipientKey).not.toHaveBeenCalled()
    })

    test('throws an error if not contextCorrelationId is provided and no tenant id could be extracted from the inbound message', async () => {
      // no routing records found
      mockFunction(tenantService.findTenantRoutingRecordByRecipientKey).mockResolvedValue(null)

      await expect(tenantAgentContextProvider.getContextForInboundMessage(inboundMessage)).rejects.toThrowError(
        "Couldn't determine tenant id for inbound message. Unable to create context"
      )
    })

    test('finds the tenant id based on the inbound message recipient keys and calls get agent context', async () => {
      const tenantRoutingRecord = new TenantRoutingRecord({
        recipientKeyFingerprint: 'z6MkkrCJLG5Mr8rqLXDksuWXPtAQfv95q7bHW7a6HqLLPtmt',
        tenantId: 'tenant1',
      })

      const tenantRecord = new TenantRecord({
        id: 'tenant1',
        config: {
          label: 'Test Tenant',
          walletConfig: {
            id: 'test-wallet',
            key: 'test-wallet-key',
          },
        },
      })

      const tenantAgentContext = jest.fn() as unknown as AgentContext
      mockFunction(tenantService.findTenantRoutingRecordByRecipientKey).mockResolvedValue(tenantRoutingRecord)

      mockFunction(tenantService.getTenantById).mockResolvedValue(tenantRecord)
      mockFunction(tenantSessionCoordinator.getContextForSession).mockResolvedValue(tenantAgentContext)

      const returnedAgentContext = await tenantAgentContextProvider.getContextForInboundMessage(inboundMessage)

      expect(tenantService.getTenantById).toHaveBeenCalledWith(rootAgentContext, 'tenant1')
      expect(tenantSessionCoordinator.getContextForSession).toHaveBeenCalledWith(tenantRecord)
      expect(returnedAgentContext).toBe(tenantAgentContext)
      expect(tenantService.findTenantRoutingRecordByRecipientKey).toHaveBeenCalledWith(
        rootAgentContext,
        expect.any(Key)
      )

      const actualKey = mockFunction(tenantService.findTenantRoutingRecordByRecipientKey).mock.calls[0][1]
      // Based on the recipient key from the inboundMessage protected header above
      expect(actualKey.fingerprint).toBe('z6MkkrCJLG5Mr8rqLXDksuWXPtAQfv95q7bHW7a6HqLLPtmt')
    })
  })
})
