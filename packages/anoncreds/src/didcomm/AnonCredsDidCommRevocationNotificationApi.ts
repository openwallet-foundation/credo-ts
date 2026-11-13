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
  DidCommMessageSender,
  getOutboundDidCommMessageContext,
} from '@credo-ts/didcomm'
import type { SendRevocationNotificationOptions } from './AnonCredsDidCommRevocationNotificationApiOptions'
import { DidCommRevocationNotificationService } from './revocation-notification/services'

@injectable()
export class AnonCredsDidCommRevocationNotificationApi {
  private agentContext: AgentContext
  private connectionService: DidCommConnectionService
  private credentialsApi: DidCommCredentialsApi<DidCommCredentialProtocol[]>
  private messageSender: DidCommMessageSender
  private revocationNotificationService: DidCommRevocationNotificationService

  public constructor(
    agentContext: AgentContext,
    connectionService: DidCommConnectionService,
    credentialsApi: DidCommCredentialsApi<DidCommCredentialProtocol[]>,
    messageSender: DidCommMessageSender,
    revocationNotificationService: DidCommRevocationNotificationService
  ) {
    this.agentContext = agentContext
    this.connectionService = connectionService
    this.credentialsApi = credentialsApi
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
      credentialExchangeRecord = await this.credentialsApi.getById(credentialExchangeRecordId)
      if (credentialExchangeRecord.connectionId) {
        connectionRecord = await this.connectionService.getById(
          this.agentContext,
          credentialExchangeRecord.connectionId
        )
        connectionRecord.assertReady()
      }

      credentialMessage = (await this.credentialsApi.findCredentialMessage(credentialExchangeRecordId)) ?? undefined
      requestMessage = (await this.credentialsApi.findRequestMessage(credentialExchangeRecordId)) ?? undefined
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
