import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { PresentationProblemReportReason } from './PresentationProblemReportReason'

import { ProblemReportError } from '../../problem-reports'
import { PresentationProblemReportMessage } from '../messages/PresentationProblemReportMessage'

interface PresentationProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: PresentationProblemReportReason
}

export class PresentationProblemReportError extends ProblemReportError {
  public problemReport: PresentationProblemReportMessage

  public constructor(public message: string, { problemCode }: PresentationProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new PresentationProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
