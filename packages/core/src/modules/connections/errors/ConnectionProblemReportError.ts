import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { ConnectionProblemReportReason } from './ConnectionProblemReportReason'

import { ProblemReportError } from '../../problem-reports'
import { ConnectionProblemReportMessage } from '../messages'

interface ConnectionProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: ConnectionProblemReportReason
}
export class ConnectionProblemReportError extends ProblemReportError {
  public problemReport: ConnectionProblemReportMessage

  public constructor(public message: string, { problemCode }: ConnectionProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new ConnectionProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
