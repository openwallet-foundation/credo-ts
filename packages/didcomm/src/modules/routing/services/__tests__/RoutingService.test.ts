import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Subject } from 'rxjs'

import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../core/src/agent/EventEmitter'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../core/tests/helpers'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../../node/src'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommRoutingEventTypes } from '../../DidCommRoutingEvents'
import type { DidCommMediationRecord } from '../../repository'
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

  describe('deleteRouting', () => {
    test('deletes all keys when removing them from a mediator fails', async () => {
      const kms = agentContext.resolve(Kms.KeyManagementApi)
      const createRoutingKey = async () => {
        const { keyId, publicJwk } = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
        return { keyId, publicJwk: Kms.PublicJwk.fromPublicJwk(publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk> }
      }
      const failingMediatorKey = await createRoutingKey()
      const otherMediatorKey = await createRoutingKey()
      const mediationRecord = (id: string, publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>) =>
        ({ id, recipientKeys: [TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)] }) as DidCommMediationRecord
      mockFunction(mediationRecipientService.findAllMediatorsByQuery).mockResolvedValue([
        mediationRecord('failing-mediator', failingMediatorKey.publicJwk),
        mediationRecord('other-mediator', otherMediatorKey.publicJwk),
      ])
      mockFunction(mediationRecipientService.removeMediationRouting).mockImplementation(async (_, { mediatorId }) => {
        if (mediatorId === 'failing-mediator') throw new Error('mediator unreachable')
      })
      const routingListener = vi.fn()
      eventEmitter.on(DidCommRoutingEventTypes.RoutingDeletedEvent, routingListener)

      const keys = [failingMediatorKey, otherMediatorKey].map(({ keyId, publicJwk }) => ({
        keyId,
        publicJwk: publicJwk.toJson({ includeKid: false }),
      }))
      await routingService.deleteRouting(agentContext, { keys })

      expect(mediationRecipientService.removeMediationRouting).toHaveBeenCalledTimes(2)
      await expect(kms.getPublicKey({ keyId: failingMediatorKey.keyId })).rejects.toThrow(
        Kms.KeyManagementKeyNotFoundError
      )
      await expect(kms.getPublicKey({ keyId: otherMediatorKey.keyId })).rejects.toThrow(
        Kms.KeyManagementKeyNotFoundError
      )
      expect(routingListener).toHaveBeenCalledTimes(1)
    })
  })
})
