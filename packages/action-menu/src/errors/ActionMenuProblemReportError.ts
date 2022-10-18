import type { ActionMenuProblemReportReason } from './ActionMenuProblemReportReason'
import type { ProblemReportErrorOptions } from '@aries-framework/core'

import { ProblemReportError } from '@aries-framework/core'

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
