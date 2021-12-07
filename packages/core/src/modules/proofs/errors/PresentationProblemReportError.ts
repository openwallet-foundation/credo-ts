import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { PresentationProblemReportReason } from './PresentationProblemReportReason'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { PresentationProblemReportMessage } from '../messages'

interface PresentationProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: PresentationProblemReportReason
}

export class PresentationProblemReportError extends AriesFrameworkError {
  public problemReport: PresentationProblemReportMessage

  public constructor(public message: string, { problemCode }: PresentationProblemReportErrorOptions) {
    super(message)
    this.problemReport = new PresentationProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
