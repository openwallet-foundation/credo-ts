import type { DidCommPresentationProblemReportReason, DidCommProblemReportErrorOptions } from '@credo-ts/didcomm'

import { DidCommProblemReportError } from '@credo-ts/didcomm'

import { DidCommPresentationV1ProblemReportMessage as DidCommPresentationV1ProblemReportMessage } from '../messages'

interface DidCommPresentationV1ProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: DidCommPresentationProblemReportReason
}

export class DidCommPresentationV1ProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommPresentationV1ProblemReportMessage

  public constructor(
    public message: string,
    { problemCode }: DidCommPresentationV1ProblemReportErrorOptions
  ) {
    super(message, { problemCode })
    this.problemReport = new DidCommPresentationV1ProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
