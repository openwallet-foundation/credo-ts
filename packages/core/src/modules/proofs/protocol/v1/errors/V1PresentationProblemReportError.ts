import type { ProblemReportErrorOptions } from '../../../../problem-reports'
import type { PresentationProblemReportReason } from '../../../errors/PresentationProblemReportReason'

import { ProblemReportError } from '../../../../problem-reports'
import { V1PresentationProblemReportMessage } from '../messages/V1PresentationProblemReportMessage'

interface V1PresentationProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: PresentationProblemReportReason
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
