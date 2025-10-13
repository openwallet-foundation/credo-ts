import type { DidCommProblemReportErrorOptions } from '../../../errors'
import { DidCommProblemReportError } from '../../../errors'
import { DidCommDidExchangeProblemReportMessage } from '../messages'
import type { DidExchangeProblemReportReason } from './DidExchangeProblemReportReason'

interface DidExchangeProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: DidExchangeProblemReportReason
}
export class DidExchangeProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommDidExchangeProblemReportMessage

  public constructor(
    public message: string,
    { problemCode }: DidExchangeProblemReportErrorOptions
  ) {
    super(message, { problemCode })
    this.problemReport = new DidCommDidExchangeProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
