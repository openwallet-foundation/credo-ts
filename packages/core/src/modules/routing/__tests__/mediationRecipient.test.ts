import type { Wallet } from '../../../wallet/Wallet'

import { getAgentConfig } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageReceiver } from '../../../agent/MessageReceiver'
import { MessageSender } from '../../../agent/MessageSender'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../error'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { ConnectionRepository } from '../../connections'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DeliveryRequestMessage, MessageDeliveryMessage, MessagesReceivedMessage, StatusMessage } from '../messages'
import { MediationRepository } from '../repository'
import { MediationRecipientService } from '../services'

jest.mock('../repository/MediationRepository')
const MediationRepositoryMock = MediationRepository as jest.Mock<MediationRepository>

jest.mock('../../connections/repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>

jest.mock('../../../agent/MessageSender')
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>

jest.mock('../../../agent/MessageReceiver')
const MessageReceiverMock = MessageReceiver as jest.Mock<MessageReceiver>

const connectionImageUrl = 'https://example.com/image.png'

describe('MediationRecipientService', () => {
  const config = getAgentConfig('MediationRecipientServiceTest', {
    endpoints: ['http://agent.com:8080'],
    connectionImageUrl,
  })

  let wallet: Wallet
  let mediationRepository: MediationRepository
  let eventEmitter: EventEmitter
  let connectionService: ConnectionService
  let connectionRepository: ConnectionRepository
  let messageSender: MessageSender
  let mediationRecipientService: MediationRecipientService
  let messageReceiver: MessageReceiver

  beforeAll(async () => {
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterAll(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    eventEmitter = new EventEmitter(config)
    connectionRepository = new ConnectionRepositoryMock()
    connectionService = new ConnectionService(wallet, config, connectionRepository, eventEmitter)
    mediationRepository = new MediationRepositoryMock()
    messageSender = new MessageSenderMock()
    messageReceiver = new MessageReceiverMock()
    mediationRecipientService = new MediationRecipientService(
      wallet,
      connectionService,
      messageSender,
      config,
      mediationRepository,
      eventEmitter
    )
  })

  describe('processStatus', () => {
    it('if status request has a message count of zero returns nothing', async () => {
      const status = new StatusMessage({
        messageCount: 0,
      })
      const deliveryRequestMessage = await mediationRecipientService.processStatus(status)
      expect(deliveryRequestMessage).toBeNull()
    })

    it('if it has a message count greater than zero return a valid delivery request', async () => {
      const status = new StatusMessage({
        messageCount: 1,
      })
      const deliveryRequestMessage = await mediationRecipientService.processStatus(status)
      expect(deliveryRequestMessage)
      expect(deliveryRequestMessage).toEqual(new DeliveryRequestMessage({ id: deliveryRequestMessage?.id, limit: 1 }))
    })
  })

  describe('processDelivery', () => {
    it('if the delivery has no attachments expect an error', async () => {
      expect(
        mediationRecipientService.processDelivery({} as MessageDeliveryMessage, messageReceiver)
      ).rejects.toThrowError(new AriesFrameworkError('No attachments found'))
    })
    it('other we should expect a message recieved with an message id list in it', async () => {
      const messageDeliveryMessage = new MessageDeliveryMessage({
        attachments: [
          new Attachment({
            id: '1',
            data: {},
          }),
        ],
      })
      const messagesReceivedMessage = await mediationRecipientService.processDelivery(
        messageDeliveryMessage,
        messageReceiver
      )
      expect(messagesReceivedMessage).toEqual(
        new MessagesReceivedMessage({
          id: messagesReceivedMessage.id,
          messageIdList: ['1'],
        })
      )
    })
  })
})
