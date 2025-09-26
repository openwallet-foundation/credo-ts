import { CredoError } from '@credo-ts/core'

import { DidCommProblemReportMessage } from '../../messages/problem-reports'

export interface DidCommProblemReportErrorOptions {
  problemCode: string
}

export class DidCommProblemReportError extends CredoError {
  public problemReport: DidCommProblemReportMessage

  public constructor(message: string, { problemCode }: DidCommProblemReportErrorOptions) {
    super(message)
    this.problemReport = new DidCommProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
