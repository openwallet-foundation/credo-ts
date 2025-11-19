import type { DidCommCredentialProblemReportReason, DidCommProblemReportErrorOptions } from '@credo-ts/didcomm'

import { DidCommProblemReportError } from '@credo-ts/didcomm'

import { DidCommCredentialV1ProblemReportMessage } from '../messages'

export interface DidCommCredentialV1ProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: DidCommCredentialProblemReportReason
}

export class DidCommCredentialV1ProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommCredentialV1ProblemReportMessage

  public constructor(message: string, { problemCode }: DidCommCredentialV1ProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new DidCommCredentialV1ProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
