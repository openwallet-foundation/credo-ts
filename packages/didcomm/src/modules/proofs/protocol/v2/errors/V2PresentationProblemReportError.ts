import type { DidCommProblemReportErrorOptions } from '../../../../../errors'
import { DidCommProblemReportError } from '../../../../../errors'
import type { DidCommPresentationProblemReportReason } from '../../../errors/DidCommPresentationProblemReportReason'
import { DidCommPresentationV2ProblemReportMessage } from '../messages'

interface V2PresentationProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: DidCommPresentationProblemReportReason
}

export class V2PresentationProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommPresentationV2ProblemReportMessage

  public constructor(
    public message: string,
    { problemCode }: V2PresentationProblemReportErrorOptions
  ) {
    super(message, { problemCode })
    this.problemReport = new DidCommPresentationV2ProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
