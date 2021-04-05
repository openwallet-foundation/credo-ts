import indy from 'indy-sdk'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { Wallet } from '../../../wallet/Wallet'
import { Repository } from '../../../storage/Repository'
import { StorageService } from '../../../storage/StorageService'
import { IndyStorageService } from '../../../storage/IndyStorageService'
import { BasicMessageService, BasicMessageEventType } from '../services'
import { BasicMessageRecord } from '../repository/BasicMessageRecord'
import { BasicMessage } from '../messages'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { ConnectionRecord } from '../../connections'
import { AgentConfig } from '../../../agent/AgentConfig'

describe('BasicMessageService', () => {
  const walletConfig = { id: 'test-wallet' + '-BasicMessageServiceTest' }
  const walletCredentials = { key: 'key' }
  const mockConnectionRecord = {
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    verkey: '71X9Y1aSPK11ariWUYQCYMjSewf2Kw2JFGeygEf9uZd9',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
    didDoc: {},
    tags: {},
  }

  let wallet: Wallet
  let storageService: StorageService<BasicMessageRecord>

  beforeAll(async () => {
    wallet = new IndyWallet(
      new AgentConfig({
        walletConfig,
        walletCredentials,
        indy,
        label: 'test',
      })
    )
    await wallet.init()
    storageService = new IndyStorageService(wallet)
  })

  afterAll(async () => {
    await wallet.close()
    await wallet.delete()
  })

  describe('save', () => {
    let basicMessageRepository: Repository<BasicMessageRecord>
    let basicMessageService: BasicMessageService

    beforeEach(() => {
      basicMessageRepository = new Repository<BasicMessageRecord>(BasicMessageRecord, storageService)
      basicMessageService = new BasicMessageService(basicMessageRepository)
    })

    it(`emits newMessage with connection verkey and message itself`, async () => {
      const eventListenerMock = jest.fn()
      basicMessageService.on(BasicMessageEventType.MessageReceived, eventListenerMock)

      const basicMessage = new BasicMessage({
        id: '123',
        content: 'message',
      })

      const messageContext = new InboundMessageContext(basicMessage, {
        senderVerkey: 'senderKey',
        recipientVerkey: 'recipientKey',
      })

      // TODO
      // Currently, it's not so easy to create instance of ConnectionRecord object.
      // We use simple `mockConnectionRecord` as ConnectionRecord type
      await basicMessageService.save(messageContext, mockConnectionRecord as ConnectionRecord)

      expect(eventListenerMock).toHaveBeenCalledWith({
        verkey: mockConnectionRecord.verkey,
        message: messageContext.message,
      })
    })
  })
})
