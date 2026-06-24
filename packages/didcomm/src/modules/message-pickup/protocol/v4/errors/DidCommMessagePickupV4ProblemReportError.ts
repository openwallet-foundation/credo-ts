import type { DidCommProblemReportErrorOptions } from '../../../../../errors'
import { DidCommProblemReportError } from '../../../../../errors'
import { DidCommMessagePickupV4ProblemReportMessage } from '../messages/DidCommMessagePickupV4ProblemReportMessage'
import type { DidCommMessagePickupV4ProblemReportReason } from './DidCommMessagePickupV4ProblemReportReason'

export interface DidCommMessagePickupV4ProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: DidCommMessagePickupV4ProblemReportReason
}

export class DidCommMessagePickupV4ProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommMessagePickupV4ProblemReportMessage

  public constructor(message: string, { problemCode }: DidCommMessagePickupV4ProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new DidCommMessagePickupV4ProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
