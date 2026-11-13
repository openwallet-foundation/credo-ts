import {
  DidCommConnectionService,
  DidCommCredentialExchangeRecord,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommCredentialsApi,
  DidCommCredentialsModuleConfig,
  DidCommDidExchangeState,
  DidCommIssueCredentialV2Message,
  DidCommMessageSender,
  DidCommOutboundMessageContext,
  DidCommRequestCredentialV2Message,
  getOutboundDidCommMessageContext,
} from '@credo-ts/didcomm'
import type { MockedClassConstructor } from '../../../../../tests/types'
import { getAgentConfig, getAgentContext, getMockConnection } from '../../../../core/tests/helpers'
import { AnonCredsDidCommRevocationNotificationApi } from '../AnonCredsDidCommRevocationNotificationApi'
import { AnonCredsRevocationNotificationProcessor } from '../AnonCredsRevocationNotificationProcessor'
import { DidCommRevocationNotificationV2Message } from '../revocation-notification/messages'
import { DidCommRevocationNotificationService } from '../revocation-notification/services'

vi.mock('../../../../didcomm/src/modules/connections/services/DidCommConnectionService')
vi.mock('../../../../didcomm/src/modules/credentials/DidCommCredentialsApi')
vi.mock('../../../../didcomm/src/DidCommMessageSender')
vi.mock('../../../../didcomm/src/getDidCommOutboundMessageContext')
vi.mock('../AnonCredsRevocationNotificationProcessor')

const ConnectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>
const CredentialsApiMock = DidCommCredentialsApi as MockedClassConstructor<typeof DidCommCredentialsApi>
const MessageSenderMock = DidCommMessageSender as MockedClassConstructor<typeof DidCommMessageSender>
const ProcessorMock = AnonCredsRevocationNotificationProcessor as MockedClassConstructor<
  typeof AnonCredsRevocationNotificationProcessor
>

describe('AnonCredsDidCommRevocationNotificationApi', () => {
  const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
  const options = { revocationId: 'registry-id::1', revocationFormat: 'anoncreds' }

  function setup({ credentialsEnabled = true } = {}) {
    const agentContext = getAgentContext()
    const connectionService = new ConnectionServiceMock()
    const credentialsApi = new CredentialsApiMock()
    if (credentialsEnabled) {
      agentContext.dependencyManager.registerInstance(
        DidCommCredentialsModuleConfig,
        new DidCommCredentialsModuleConfig({ credentialProtocols: [] })
      )
      agentContext.dependencyManager.registerInstance(DidCommCredentialsApi, credentialsApi)
    }
    const messageSender = new MessageSenderMock()
    const processor = new ProcessorMock()
    const service = new DidCommRevocationNotificationService(
      getAgentConfig('AnonCredsDidCommRevocationNotificationApi').logger,
      processor
    )
    const api = new AnonCredsDidCommRevocationNotificationApi(agentContext, connectionService, messageSender, service)
    vi.mocked(connectionService.getById).mockResolvedValue(connection)
    vi.mocked(getOutboundDidCommMessageContext).mockImplementation(async (context, options) => {
      return new DidCommOutboundMessageContext(options.message, {
        agentContext: context,
        connection: options.connectionRecord,
        associatedRecord: options.associatedRecord,
      })
    })
    return { api, agentContext, connectionService, credentialsApi, messageSender }
  }

  test('sends a V2 notification with comment and acknowledgement request to an explicit connection', async () => {
    const { api, agentContext, connectionService, credentialsApi, messageSender } = setup()

    await api.sendRevocationNotification({
      ...options,
      connectionId: connection.id,
      comment: 'Revoked',
      requestAck: true,
    })

    expect(connectionService.getById).toHaveBeenCalledWith(agentContext, connection.id)
    expect(credentialsApi.getById).not.toHaveBeenCalled()
    expect(messageSender.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        connection,
        message: expect.objectContaining({
          type: DidCommRevocationNotificationV2Message.type.messageTypeUri,
          credentialId: options.revocationId,
          revocationFormat: options.revocationFormat,
          comment: 'Revoked',
          pleaseAck: expect.anything(),
        }),
      })
    )
  })

  test.each([true, false])('preserves credential-exchange routing with connected=%s', async (connected) => {
    const { api, agentContext, connectionService, credentialsApi, messageSender } = setup()
    const record = new DidCommCredentialExchangeRecord({
      connectionId: connected ? connection.id : undefined,
      threadId: 'thread-id',
      protocolVersion: 'v2',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Issuer,
    })
    const credentialMessage = new DidCommIssueCredentialV2Message({
      formats: [],
      credentialAttachments: [],
    })
    const requestMessage = new DidCommRequestCredentialV2Message({
      formats: [],
      requestAttachments: [],
    })
    vi.mocked(credentialsApi.getById).mockResolvedValue(record)
    vi.mocked(credentialsApi.findCredentialMessage).mockResolvedValue(credentialMessage)
    vi.mocked(credentialsApi.findRequestMessage).mockResolvedValue(requestMessage)

    await api.sendRevocationNotification({ ...options, credentialExchangeRecordId: record.id })

    expect(getOutboundDidCommMessageContext).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({
        associatedRecord: record,
        connectionRecord: connected ? connection : undefined,
        lastSentMessage: credentialMessage,
        lastReceivedMessage: requestMessage,
      })
    )
    expect(connectionService.getById).toHaveBeenCalledTimes(connected ? 1 : 0)
    expect(messageSender.sendMessage).toHaveBeenCalledTimes(1)
  })

  test('rejects sending without a connection or credential exchange', async () => {
    const { api, messageSender } = setup()

    await expect(api.sendRevocationNotification(options)).rejects.toThrow(
      'Either credentialExchangeRecordId or connectionId must be defined'
    )
    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })

  test('reports the missing credentials module when sending using a credential exchange', async () => {
    const { api, credentialsApi, messageSender } = setup({ credentialsEnabled: false })

    await expect(
      api.sendRevocationNotification({ ...options, credentialExchangeRecordId: 'exchange-id' })
    ).rejects.toThrow('AnonCredsDidCommRevocationNotificationModule requires DIDComm credentials to be enabled.')
    expect(credentialsApi.getById).not.toHaveBeenCalled()
    expect(messageSender.sendMessage).not.toHaveBeenCalled()
  })
})
