import { getAgentConfig, getAgentContext } from '../../../../../../../../core/tests/helpers'
import { DidCommInboundMessageContext } from '../../../../../../models'
import { DidCommRevocationNotificationV1Message, DidCommRevocationNotificationV2Message } from '../../messages'
import type { DidCommRevocationNotificationProcessor } from '../DidCommRevocationNotificationProcessor'
import { DidCommRevocationNotificationProcessorToken } from '../DidCommRevocationNotificationProcessor'
import { DidCommRevocationNotificationService } from '../DidCommRevocationNotificationService'

describe('DidCommRevocationNotificationService', () => {
  const logger = getAgentConfig('RevocationNotificationService').logger

  test('dispatches v1 notifications to the configured processor', async () => {
    const processor: DidCommRevocationNotificationProcessor = {
      processV1: vi.fn(),
      processV2: vi.fn(),
    }
    const agentContext = getAgentContext({
      registerInstances: [[DidCommRevocationNotificationProcessorToken, processor]],
    })
    const messageContext = new DidCommInboundMessageContext(
      new DidCommRevocationNotificationV1Message({ issueThread: 'opaque-thread' }),
      { agentContext }
    )
    const service = new DidCommRevocationNotificationService(logger)

    await service.v1ProcessRevocationNotification(messageContext)

    expect(processor.processV1).toHaveBeenCalledWith(messageContext)
  })

  test('dispatches v2 notifications to the configured processor', async () => {
    const processor: DidCommRevocationNotificationProcessor = {
      processV1: vi.fn(),
      processV2: vi.fn(),
    }
    const agentContext = getAgentContext({
      registerInstances: [[DidCommRevocationNotificationProcessorToken, processor]],
    })
    const messageContext = new DidCommInboundMessageContext(
      new DidCommRevocationNotificationV2Message({
        credentialId: 'opaque-identifier',
        revocationFormat: 'example',
      }),
      { agentContext }
    )
    const service = new DidCommRevocationNotificationService(logger)

    await service.v2ProcessRevocationNotification(messageContext)

    expect(processor.processV2).toHaveBeenCalledWith(messageContext)
  })

  test('fails explicitly when no notification processor is registered', async () => {
    const agentContext = getAgentContext()
    const messageContext = new DidCommInboundMessageContext(
      new DidCommRevocationNotificationV1Message({ issueThread: 'opaque-thread' }),
      { agentContext }
    )
    const service = new DidCommRevocationNotificationService(logger)

    await expect(service.v1ProcessRevocationNotification(messageContext)).rejects.toThrow(
      'No revocation notification processor is registered'
    )
  })

  test('creates a v2 revocation notification message', async () => {
    const service = new DidCommRevocationNotificationService(logger)
    const { message } = await service.v2CreateRevocationNotification({
      credentialId: 'opaque-identifier',
      revocationFormat: 'example',
    })

    expect(message).toBeInstanceOf(DidCommRevocationNotificationV2Message)
    expect(message.credentialId).toBe('opaque-identifier')
    expect(message.revocationFormat).toBe('example')
  })
})
