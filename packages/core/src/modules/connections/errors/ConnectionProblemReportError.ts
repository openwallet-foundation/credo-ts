import type { ConnectionProblemReportReason } from './ConnectionProblemReportReason'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'

export class ConnectionProblemReportError extends AriesFrameworkError {
  public constructor(public message: string, public problemCode: ConnectionProblemReportReason) {
    super(message)
  }
}
