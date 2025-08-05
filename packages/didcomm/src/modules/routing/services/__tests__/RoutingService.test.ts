import { Subject } from 'rxjs'

import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../core/tests/helpers'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../../node/src'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { RoutingEventTypes } from '../../RoutingEvents'
import { MediationRecipientService } from '../MediationRecipientService'
import { RoutingService } from '../RoutingService'

jest.mock('../MediationRecipientService')
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>

const agentConfig = getAgentConfig('RoutingService', {
  endpoints: ['http://endpoint.com'],
})
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
const agentContext = getAgentContext({
  agentConfig,
  registerInstances: [[DidCommModuleConfig, new DidCommModuleConfig({ endpoints: ['http://endpoint.com'] })]],
  kmsBackends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
})
const mediationRecipientService = new MediationRecipientServiceMock()
const routingService = new RoutingService(mediationRecipientService, eventEmitter)
mockFunction(mediationRecipientService.addMediationRouting).mockImplementation(async (_, routing) => routing)

describe('RoutingService', () => {
  afterEach(() => {
    jest.clearAllMocks()
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
      const routingListener = jest.fn()
      eventEmitter.on(RoutingEventTypes.RoutingCreatedEvent, routingListener)

      const newRouting = await routingService.getRouting(agentContext)

      expect(routingListener).toHaveBeenCalledWith({
        type: RoutingEventTypes.RoutingCreatedEvent,
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
