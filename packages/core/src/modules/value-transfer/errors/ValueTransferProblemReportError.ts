import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'

export interface ProblemReportErrorOptions {
  pthid: string
  problemCode: string
}

export class ValueTransferProblemReportError extends AriesFrameworkError {
  public problemReport: ProblemReportMessage

  public constructor(message: string, { problemCode, pthid }: ProblemReportErrorOptions) {
    super(message)
    this.problemReport = new ProblemReportMessage({
      pthid: pthid,
      body: {
        code: problemCode,
        comment: message,
      },
    })
  }
}
