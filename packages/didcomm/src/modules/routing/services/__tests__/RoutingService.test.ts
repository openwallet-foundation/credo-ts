import { Subject } from 'rxjs'

import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../core/tests/helpers'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../../node/src'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommRoutingEventTypes } from '../../DidCommRoutingEvents'
import { DidCommMediationRecipientService } from '../DidCommMediationRecipientService'
import { DidCommRoutingService } from '../DidCommRoutingService'

vi.mock('../DidCommMediationRecipientService')
const MediationRecipientServiceMock = DidCommMediationRecipientService as MockedClassConstructor<
  typeof DidCommMediationRecipientService
>

const agentConfig = getAgentConfig('DidCommRoutingService', {
  endpoints: ['http://endpoint.com'],
})
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
const agentContext = getAgentContext({
  agentConfig,
  registerInstances: [[DidCommModuleConfig, new DidCommModuleConfig({ endpoints: ['http://endpoint.com'] })]],
  kmsBackends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
})
const mediationRecipientService = new MediationRecipientServiceMock()
const routingService = new DidCommRoutingService(mediationRecipientService, eventEmitter)
mockFunction(mediationRecipientService.addMediationRouting).mockImplementation(async (_, routing) => routing)

describe('DidCommRoutingService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getRouting', () => {
    test('calls mediation recipient service', async () => {
      const newRouting = await routingService.getRouting(agentContext, {
        mediatorId: 'mediator-id',
        useDefaultMediator: true,
      })

      expect(mediationRecipientService.addMediationRouting).toHaveBeenCalledWith(agentContext, newRouting, {
        mediatorId: 'mediator-id',
        useDefaultMediator: true,
      })
    })

    test('emits RoutingCreatedEvent', async () => {
      const routingListener = vi.fn()
      eventEmitter.on(DidCommRoutingEventTypes.RoutingCreatedEvent, routingListener)

      const newRouting = await routingService.getRouting(agentContext)

      expect(routingListener).toHaveBeenCalledWith({
        type: DidCommRoutingEventTypes.RoutingCreatedEvent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          routing: newRouting,
        },
      })
    })
  })
})
