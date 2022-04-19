import type { ProblemReportMessageOptions } from '../../problem-reports/messages/ProblemReportMessage'

import { Equals } from 'class-validator'

import { parseMessageType } from '../../../utils/messageType'
import { ProblemReportMessage } from '../../problem-reports/messages/ProblemReportMessage'

export type ConnectionProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class ConnectionProblemReportMessage extends ProblemReportMessage {
  /**
   * Create new ConnectionProblemReportMessage instance.
   * @param options
   */
  public constructor(options: ConnectionProblemReportMessageOptions) {
    super(options)
  }

  @Equals(ConnectionProblemReportMessage.type)
  public readonly type = ConnectionProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/connection/1.0/problem-report')
}
