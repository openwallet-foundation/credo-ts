import type { DidCommProblemReportErrorOptions } from '../../../errors'
import { DidCommProblemReportError } from '../../../errors'
import { DidCommConnectionProblemReportMessage } from '../messages'
import type { ConnectionProblemReportReason } from './ConnectionProblemReportReason'

interface ConnectionProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: ConnectionProblemReportReason
}
export class ConnectionProblemReportError extends DidCommProblemReportError {
  public problemReport: DidCommConnectionProblemReportMessage

  public constructor(
    public message: string,
    { problemCode }: ConnectionProblemReportErrorOptions
  ) {
    super(message, { problemCode })
    this.problemReport = new DidCommConnectionProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
