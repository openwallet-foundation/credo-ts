import { AriesFrameworkError } from '../../../error/CredoError'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'

export interface ProblemReportErrorOptions {
  problemCode: string
}

export class ProblemReportError extends AriesFrameworkError {
  public problemReport: ProblemReportMessage

  public constructor(message: string, { problemCode }: ProblemReportErrorOptions) {
    super(message)
    this.problemReport = new ProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
