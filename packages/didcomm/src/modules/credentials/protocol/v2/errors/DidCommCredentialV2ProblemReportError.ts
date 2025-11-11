import type { DidCommProblemReportErrorOptions } from '../../../../../errors'
import { DidCommProblemReportError } from '../../../../../errors'
import type { DidCommCredentialProblemReportReason } from '../../../models/DidCommCredentialProblemReportReason'
import { DidCommCredentialV2ProblemReportMessage } from '../messages/DidCommCredentialV2ProblemReportMessage'

export interface DidCommCredentialV2ProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: DidCommCredentialProblemReportReason
}

export class DidCommCredentialV2ProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommCredentialV2ProblemReportMessage

  public constructor(message: string, { problemCode }: DidCommCredentialV2ProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new DidCommCredentialV2ProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
