import { AgentContext, CredoError, injectable } from '@credo-ts/core'
import type {
  DidCommConnectionRecord,
  DidCommCredentialExchangeRecord,
  DidCommCredentialProtocol,
  DidCommMessage,
} from '@credo-ts/didcomm'
import {
  DidCommConnectionService,
  DidCommCredentialsApi,
  DidCommCredentialsModuleConfig,
  DidCommMessageSender,
  getOutboundDidCommMessageContext,
} from '@credo-ts/didcomm'
import type { SendRevocationNotificationOptions } from './AnonCredsDidCommRevocationNotificationApiOptions'
import { DidCommRevocationNotificationService } from './revocation-notification/services'

@injectable()
export class AnonCredsDidCommRevocationNotificationApi {
  private agentContext: AgentContext
  private connectionService: DidCommConnectionService
  private messageSender: DidCommMessageSender
  private revocationNotificationService: DidCommRevocationNotificationService

  public constructor(
    agentContext: AgentContext,
    connectionService: DidCommConnectionService,
    messageSender: DidCommMessageSender,
    revocationNotificationService: DidCommRevocationNotificationService
  ) {
    this.agentContext = agentContext
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.revocationNotificationService = revocationNotificationService
  }

  /**
   * Send a V2 notification using an explicit connection or the routing associated with a credential exchange.
   */
  public async sendRevocationNotification(options: SendRevocationNotificationOptions): Promise<void> {
    const { connectionId, credentialExchangeRecordId, revocationId, revocationFormat, comment, requestAck } = options

    let credentialExchangeRecord: DidCommCredentialExchangeRecord | undefined
    let connectionRecord: DidCommConnectionRecord | undefined
    let credentialMessage: DidCommMessage | undefined
    let requestMessage: DidCommMessage | undefined

    if (credentialExchangeRecordId) {
      if (!this.agentContext.dependencyManager.isRegistered(DidCommCredentialsModuleConfig, true)) {
        throw new CredoError('AnonCredsDidCommRevocationNotificationModule requires DIDComm credentials to be enabled.')
      }
      const credentialsApi =
        this.agentContext.dependencyManager.resolve<DidCommCredentialsApi<DidCommCredentialProtocol[]>>(
          DidCommCredentialsApi
        )
      credentialExchangeRecord = await credentialsApi.getById(credentialExchangeRecordId)
      if (credentialExchangeRecord.connectionId) {
        connectionRecord = await this.connectionService.getById(
          this.agentContext,
          credentialExchangeRecord.connectionId
        )
        connectionRecord.assertReady()
      }

      const config =
        this.agentContext.dependencyManager.resolve<DidCommCredentialsModuleConfig<DidCommCredentialProtocol[]>>(
          DidCommCredentialsModuleConfig
        )
      const { protocolVersion } = credentialExchangeRecord
      const protocol = config.credentialProtocols.find((protocol) => protocol.version === protocolVersion)
      if (!protocol) {
        throw new CredoError(`No credential protocol registered for protocol version ${protocolVersion}`)
      }

      credentialMessage =
        (await protocol.findCredentialMessage(this.agentContext, credentialExchangeRecordId)) ?? undefined
      requestMessage = (await protocol.findRequestMessage(this.agentContext, credentialExchangeRecordId)) ?? undefined
    } else if (connectionId) {
      connectionRecord = await this.connectionService.getById(this.agentContext, connectionId)
      connectionRecord.assertReady()
    } else {
      throw new CredoError('Either credentialExchangeRecordId or connectionId must be defined')
    }

    if (!connectionId && !credentialMessage) {
      throw new CredoError('No associated DIDComm connection was found for the revocation notification')
    }

    const { message } = await this.revocationNotificationService.v2CreateRevocationNotification({
      credentialId: revocationId,
      revocationFormat,
      comment,
      requestAck,
    })

    const outboundMessageContext = await getOutboundDidCommMessageContext(this.agentContext, {
      message,
      connectionRecord,
      associatedRecord: credentialExchangeRecord,
      lastSentMessage: credentialMessage,
      lastReceivedMessage: requestMessage,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
  }
}
