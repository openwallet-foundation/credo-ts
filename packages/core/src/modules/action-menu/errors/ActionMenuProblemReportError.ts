import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { ActionMenuProblemReportReason } from './ActionMenuProblemReportReason'

import { ProblemReportError } from '../../problem-reports'
import { ActionMenuProblemReportMessage } from '../messages'

interface ActionMenuProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: ActionMenuProblemReportReason
}
export class ActionMenuProblemReportError extends ProblemReportError {
  public problemReport: ActionMenuProblemReportMessage

  public constructor(public message: string, { problemCode }: ActionMenuProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new ActionMenuProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
