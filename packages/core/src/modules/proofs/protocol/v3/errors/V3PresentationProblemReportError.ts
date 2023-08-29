import type { ProblemReportErrorOptions } from '../../../../problem-reports'
import type { PresentationProblemReportReason } from '../../../errors/PresentationProblemReportReason'

import { V2ProblemReportError } from '../../../../problem-reports/errors/V2ProblemReportError'
import { V3PresentationProblemReportMessage as V3PresentationProblemReportMessage } from '../messages'

interface V3PresentationProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: PresentationProblemReportReason
  parentThreadId: string
}

export class V3PresentationProblemReportError extends V2ProblemReportError {
  public problemReport: V3PresentationProblemReportMessage

  public constructor(public message: string, { problemCode, parentThreadId }: V3PresentationProblemReportErrorOptions) {
    super(message, { problemCode, parentThreadId })
    this.problemReport = new V3PresentationProblemReportMessage({
      parentThreadId,
      body: {
        code: problemCode,
        comment: message,
      },
    })
  }
}
