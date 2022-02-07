import type { ProblemReportErrorOptions } from '../../../../problem-reports'
import type { V1PresentationProblemReportReason } from './V1PresentationProblemReportReason'

import { V1PresentationProblemReportMessage } from '../messages'

import { ProblemReportError } from '../../../../problem-reports/errors/ProblemReportError'

interface V1PresentationProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: V1PresentationProblemReportReason
}

export class V1PresentationProblemReportError extends ProblemReportError {
  public problemReport: V1PresentationProblemReportMessage

  public constructor(public message: string, { problemCode }: V1PresentationProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new V1PresentationProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
