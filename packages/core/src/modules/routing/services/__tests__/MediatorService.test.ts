import { getAgentConfig, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import { IndyWallet } from '../../../../wallet/IndyWallet'
import { DidExchangeState } from '../../../connections'
import { KeylistUpdateAction, KeylistUpdateMessage } from '../../messages'
import { MediationRole, MediationState } from '../../models'
import { MediationRecord } from '../../repository'
import { MediationRepository } from '../../repository/MediationRepository'
import { MediatorRoutingRepository } from '../../repository/MediatorRoutingRepository'
import { MediatorService } from '../MediatorService'

const agentConfig = getAgentConfig('MediatorService')

jest.mock('../../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../repository/MediatorRoutingRepository')
const MediatorRoutingRepositoryMock = MediatorRoutingRepository as jest.Mock<MediatorRoutingRepository>

jest.mock('../../../../wallet/IndyWallet')
const WalletMock = IndyWallet as jest.Mock<IndyWallet>

const mediationRepository = new MediationRepositoryMock()
const mediatorRoutingRepository = new MediatorRoutingRepositoryMock()

const wallet = new WalletMock()

const mediatorService = new MediatorService(
  mediationRepository,
  mediatorRoutingRepository,
  agentConfig,
  wallet,
  new EventEmitter(agentConfig)
)

const mockConnection = getMockConnection({
  state: DidExchangeState.Completed,
})

describe('MediatorService', () => {
  describe('processKeylistUpdateRequest', () => {
    test('processes base58 encoded recipient keys', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Granted,
        threadId: 'threadId',
        recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const keyListUpdate = new KeylistUpdateMessage({
        updates: [
          {
            action: KeylistUpdateAction.add,
            recipientKey: '79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ',
          },
          {
            action: KeylistUpdateAction.remove,
            recipientKey: '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K',
          },
        ],
      })

      const messageContext = new InboundMessageContext(keyListUpdate, { connection: mockConnection })
      await mediatorService.processKeylistUpdateRequest(messageContext)

      expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
    })

    test('processes did:key encoded recipient keys', async () => {
      const mediationRecord = new MediationRecord({
        connectionId: 'connectionId',
        role: MediationRole.Mediator,
        state: MediationState.Granted,
        threadId: 'threadId',
        recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      })

      mockFunction(mediationRepository.getByConnectionId).mockResolvedValue(mediationRecord)

      const keyListUpdate = new KeylistUpdateMessage({
        updates: [
          {
            action: KeylistUpdateAction.add,
            recipientKey: 'did:key:z6MkkbTaLstV4fwr1rNf5CSxdS2rGbwxi3V5y6NnVFTZ2V1w',
          },
          {
            action: KeylistUpdateAction.remove,
            recipientKey: 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
          },
        ],
      })

      const messageContext = new InboundMessageContext(keyListUpdate, { connection: mockConnection })
      await mediatorService.processKeylistUpdateRequest(messageContext)

      expect(mediationRecord.recipientKeys).toEqual(['79CXkde3j8TNuMXxPdV7nLUrT2g7JAEjH5TreyVY7GEZ'])
    })
  })
})
