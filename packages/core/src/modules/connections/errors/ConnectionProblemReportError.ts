import type { ConnectionProblemReportReason } from '.'
import type { ProblemReportErrorOptions } from '../../problem-reports'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { ConnectionProblemReportMessage } from '../messages'

interface ConnectionProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: ConnectionProblemReportReason
}
export class ConnectionProblemReportError extends AriesFrameworkError {
  public problemReport: ConnectionProblemReportMessage

  public constructor(public message: string, { problemCode }: ConnectionProblemReportErrorOptions) {
    super(message)
    this.problemReport = new ConnectionProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
