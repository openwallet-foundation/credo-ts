import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { V2ProblemReportMessage } from '../versions/v2/messages'

export interface V2ProblemReportErrorOptions {
  problemCode: string
  parentThreadId: string
}

export class V2ProblemReportError extends AriesFrameworkError {
  public problemReport: V2ProblemReportMessage

  public constructor(message: string, { problemCode, parentThreadId }: V2ProblemReportErrorOptions) {
    super(message)
    this.problemReport = new V2ProblemReportMessage({
      parentThreadId,
      body: {
        comment: message,
        code: problemCode,
      },
    })
  }
}
