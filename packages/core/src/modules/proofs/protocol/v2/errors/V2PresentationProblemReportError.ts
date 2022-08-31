import type { ProblemReportErrorOptions } from '../../../../problem-reports'
import type { PresentationProblemReportReason } from '../../../errors/PresentationProblemReportReason'

import { ProblemReportError } from '../../../../problem-reports/errors/ProblemReportError'
import { V2PresentationProblemReportMessage } from '../messages'

interface V2PresentationProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: PresentationProblemReportReason
}

export class V2PresentationProblemReportError extends ProblemReportError {
  public problemReport: V2PresentationProblemReportMessage

  public constructor(public message: string, { problemCode }: V2PresentationProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new V2PresentationProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
