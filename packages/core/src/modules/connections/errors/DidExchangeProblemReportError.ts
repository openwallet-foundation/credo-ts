import type { DidExchangeProblemReportReason } from './DidExchangeProblemReportReason'
import type { ProblemReportErrorOptions } from '../../problem-reports'

import { ProblemReportError } from '../../problem-reports'
import { DidExchangeProblemReportMessage } from '../messages'

interface DidExchangeProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: DidExchangeProblemReportReason
}
export class DidExchangeProblemReportError extends ProblemReportError {
  public problemReport: DidExchangeProblemReportMessage

  public constructor(public message: string, { problemCode }: DidExchangeProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new DidExchangeProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
