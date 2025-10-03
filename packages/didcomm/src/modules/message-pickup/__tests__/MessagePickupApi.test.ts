/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DidCommMessagePickupSession } from '../DidCommMessagePickupSession'
import type { DidCommMessagePickupProtocol } from '../protocol/DidCommMessagePickupProtocol'

import { Subject } from 'rxjs'

import { Logger } from '@credo-ts/core'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../core/src/error/CredoError'
import { testLogger } from '../../../../../core/tests'
import { getAgentContext, getMockConnection, mockFunction } from '../../../../../core/tests/helpers'
import { DidCommModuleConfig } from '../../../../../didcomm'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { DidCommDidExchangeState } from '../../connections/models/DidCommDidExchangeState'
import { DidCommConnectionService } from '../../connections/services/DidCommConnectionService'
import { DidCommMessagePickupApi } from '../DidCommMessagePickupApi'
import { DidCommMessagePickupModuleConfig } from '../DidCommMessagePickupModuleConfig'
import {
  DidCommMessageDeliveryV2Message,
  DidCommMessagePickupV1Protocol,
  DidCommMessagePickupV2Protocol,
} from '../protocol'
import { DidCommMessagePickupSessionService } from '../services/DidCommMessagePickupSessionService'

const mockConnection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

jest.mock('../../../../../core/src/agent/EventEmitter')
jest.mock('../../../DidCommMessageSender')
jest.mock('../../connections/services/DidCommConnectionService')
jest.mock('../services/DidCommMessagePickupSessionService')

const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const MessageSenderMock = DidCommMessageSender as jest.Mock<DidCommMessageSender>
const ConnectionServiceMock = DidCommConnectionService as jest.Mock<DidCommConnectionService>
const MessagePickupSessionServiceMock =
  DidCommMessagePickupSessionService as jest.Mock<DidCommMessagePickupSessionService>

const messagePickupModuleConfig = new DidCommMessagePickupModuleConfig({
  maximumBatchSize: 10,
  protocols: [new DidCommMessagePickupV1Protocol(), new DidCommMessagePickupV2Protocol()],
})

// Mock classes
const eventEmitter = new EventEmitterMock()
const messageSender = new MessageSenderMock()
const connectionService = new ConnectionServiceMock()
const messagePickupSessionService = new MessagePickupSessionServiceMock()

// Mock typed object
const agentContext = getAgentContext({
  registerInstances: [
    [EventEmitter, eventEmitter],
    [DidCommMessageSender, messageSender],
    [DidCommConnectionService, connectionService],
    [DidCommMessagePickupModuleConfig, messagePickupModuleConfig],
    [DidCommMessagePickupSessionService, messagePickupSessionService],
    [DidCommModuleConfig, new DidCommModuleConfig()],
  ],
})

describe('DidCommMessagePickupApi', () => {
  jest.resetAllMocks()

  let api: DidCommMessagePickupApi<DidCommMessagePickupProtocol[]>
  let mockLogger: Logger
  let stop$: Subject<boolean>

  beforeEach(() => {
    jest.resetAllMocks()
    stop$ = new Subject()
    mockLogger = testLogger
    api = new DidCommMessagePickupApi(
      messageSender,
      agentContext,
      connectionService,
      eventEmitter,
      messagePickupSessionService,
      messagePickupModuleConfig,
      stop$,
      mockLogger
    )
  })

  it('throws if deliverMessages has no active session', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue(undefined)

    await expect(api.deliverMessages({ pickupSessionId: 'bad', messages: [] })).rejects.toThrow(CredoError)

    expect(connectionService.getById).not.toHaveBeenCalled()
    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })

  it('sends delivery message if session is found with ws priority', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue({
      connectionId: mockConnection.id,
      protocolVersion: 'v2',
    } as DidCommMessagePickupSession)
    mockFunction(connectionService.getById).mockResolvedValue(mockConnection)

    await api.deliverMessages({
      pickupSessionId: 'pickup-1',
      messages: [
        {
          id: 'abc',
          encryptedMessage: {
            protected: 'mock-protected',
            iv: 'mock-iv',
            ciphertext: 'mock-ciphertext',
            tag: 'mock-tag',
          },
          receivedAt: new Date(),
        },
      ],
    })

    const sendMessageMock = messageSender.sendMessage as jest.Mock
    const [outboundCtx, options] = sendMessageMock.mock.calls[0]

    expect(messageSender.sendMessage).toHaveBeenCalledTimes(1)
    expect(outboundCtx.message.type).toEqual(DidCommMessageDeliveryV2Message.type.messageTypeUri)
    expect(outboundCtx.connection).toEqual(mockConnection)
    expect(options).toEqual({
      transportPriority: { schemes: ['wss', 'ws'] },
    })
  })

  it('throws if no active session is found', async () => {
    mockFunction(messagePickupSessionService.getLiveSession).mockReturnValue(undefined)

    await expect(
      api.deliverMessagesFromQueue({
        pickupSessionId: 'pickup-1',
        recipientDid: 'did:key:z6MkjFake',
        batchSize: 10,
      })
    ).rejects.toThrow(CredoError)
  })
})
