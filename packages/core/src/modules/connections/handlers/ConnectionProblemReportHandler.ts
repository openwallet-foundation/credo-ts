import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { ConnectionService } from '../services'

import { ConnectionProblemReportMessage } from '../messages'

export class ConnectionProblemReportHandler implements Handler<typeof DIDCommV1Message> {
  private connectionService: ConnectionService
  public supportedMessages = [ConnectionProblemReportMessage]

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionProblemReportHandler>) {
    await this.connectionService.processProblemReport(messageContext)
  }
}
