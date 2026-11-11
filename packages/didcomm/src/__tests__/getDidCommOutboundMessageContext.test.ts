import type { MockedClassConstructor } from '../../../../tests/types'
import { DidKey, Kms, TypedArrayEncoder } from '../../../core/src'
import { getAgentContext, getMockOutOfBand, mockFunction } from '../../../core/tests/helpers'
import { TestMessage } from '../../../core/tests/TestMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { ServiceDecorator } from '../decorators/service/ServiceDecorator'
import { getConnectionlessOutboundMessageContext } from '../getDidCommOutboundMessageContext'
import { DidCommOutOfBandRole, DidCommOutOfBandService, DidCommOutOfBandState } from '../modules/oob'
import { DidCommOutOfBandRepository } from '../modules/oob/repository/DidCommOutOfBandRepository'
import { DidCommMessageRepository } from '../repository/DidCommMessageRepository'

vi.mock('../modules/oob/repository/DidCommOutOfBandRepository')
vi.mock('../modules/oob/DidCommOutOfBandService')
vi.mock('../repository/DidCommMessageRepository')

const OutOfBandRepositoryMock = DidCommOutOfBandRepository as MockedClassConstructor<typeof DidCommOutOfBandRepository>
const OutOfBandServiceMock = DidCommOutOfBandService as MockedClassConstructor<typeof DidCommOutOfBandService>
const MessageRepositoryMock = DidCommMessageRepository as MockedClassConstructor<typeof DidCommMessageRepository>

const ourVerkey = 'ByHnpUCFb1vAfh9CFZ8ZkmUZguURW8nSw889hy6rD8L7'
const theirVerkey = 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa'
const ourPublicJwk = Kms.PublicJwk.fromPublicKey({
  kty: 'OKP',
  crv: 'Ed25519',
  publicKey: TypedArrayEncoder.fromBase58(ourVerkey),
})

describe('getConnectionlessOutboundMessageContext', () => {
  const outOfBandRepository = new OutOfBandRepositoryMock()
  const agentContext = getAgentContext({
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig()],
      [DidCommOutOfBandRepository, outOfBandRepository],
      [DidCommOutOfBandService, new OutOfBandServiceMock()],
      [DidCommMessageRepository, new MessageRepositoryMock()],
    ],
  })

  const senderOutOfBandRecord = getMockOutOfBand({
    role: DidCommOutOfBandRole.Sender,
    state: DidCommOutOfBandState.AwaitResponse,
    recipientKeys: [new DidKey(ourPublicJwk).did],
    invitationInlineServiceKeys: [{ recipientKeyFingerprint: ourPublicJwk.fingerprint, kmsKeyId: 'our-kms-key-id' }],
  })

  const getMessages = () => {
    const lastSentMessage = new TestMessage()
    lastSentMessage.service = new ServiceDecorator({ recipientKeys: [ourVerkey], serviceEndpoint: 'https://issuer' })
    const lastReceivedMessage = new TestMessage()
    lastReceivedMessage.service = new ServiceDecorator({
      recipientKeys: [theirVerkey],
      serviceEndpoint: 'https://holder',
    })

    return { lastSentMessage, lastReceivedMessage }
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('sets the sender key id from the out of band record tagged with our key for a message on a new thread', async () => {
    mockFunction(outOfBandRepository.findSingleByQuery).mockImplementation(async (_, query) =>
      'recipientKeyFingerprints' in query ? senderOutOfBandRecord : null
    )

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
      message: new TestMessage(),
      associatedRecord: senderOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-kms-key-id')
    expect(outOfBandRepository.findSingleByQuery).toHaveBeenCalledWith(agentContext, {
      role: DidCommOutOfBandRole.Sender,
      recipientKeyFingerprints: [ourPublicJwk.fingerprint],
    })
  })

  test('sets the sender key id from the thread out of band record when our service is from the last sent message', async () => {
    mockFunction(outOfBandRepository.findSingleByQuery).mockImplementation(async (_, query) =>
      'invitationRequestsThreadIds' in query ? senderOutOfBandRecord : null
    )

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
      message: new TestMessage(),
      associatedRecord: senderOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-kms-key-id')
  })
})
