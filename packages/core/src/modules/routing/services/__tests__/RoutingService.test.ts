import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { Key } from '../../../../crypto'
import { IndyWallet } from '../../../../wallet/IndyWallet'
import { RoutingEventTypes } from '../../RoutingEvents'
import { MediationRecipientService } from '../MediationRecipientService'
import { RoutingService } from '../RoutingService'

jest.mock('../../../../wallet/IndyWallet')
const IndyWalletMock = IndyWallet as jest.Mock<IndyWallet>

jest.mock('../MediationRecipientService')
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>

const agentConfig = getAgentConfig('RoutingService', {
  endpoints: ['http://endpoint.com'],
})
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
const wallet = new IndyWalletMock()
const agentContext = getAgentContext({
  wallet,
  agentConfig,
})
const mediationRecipientService = new MediationRecipientServiceMock()
const routingService = new RoutingService(mediationRecipientService, eventEmitter)

const recipientKey = Key.fromFingerprint('z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')

const routing = {
  endpoints: ['http://endpoint.com'],
  recipientKey,
  routingKeys: [],
}
mockFunction(mediationRecipientService.addMediationRouting).mockResolvedValue(routing)
mockFunction(wallet.createDid).mockResolvedValue({
  did: 'some-did',
  verkey: recipientKey.publicKeyBase58,
})

describe('RoutingService', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getRouting', () => {
    test('calls mediation recipient service', async () => {
      const routing = await routingService.getRouting(agentContext, {
        mediatorId: 'mediator-id',
        useDefaultMediator: true,
      })

      expect(mediationRecipientService.addMediationRouting).toHaveBeenCalledWith(agentContext, routing, {
        mediatorId: 'mediator-id',
        useDefaultMediator: true,
      })
    })

    test('emits RoutingCreatedEvent', async () => {
      const routingListener = jest.fn()
      eventEmitter.on(RoutingEventTypes.RoutingCreatedEvent, routingListener)

      const routing = await routingService.getRouting(agentContext)

      expect(routing).toEqual(routing)
      expect(routingListener).toHaveBeenCalledWith({
        type: RoutingEventTypes.RoutingCreatedEvent,
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          routing,
        },
      })
    })
  })
})
