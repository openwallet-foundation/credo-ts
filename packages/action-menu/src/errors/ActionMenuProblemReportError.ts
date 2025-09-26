import type { DidCommProblemReportErrorOptions } from '@credo-ts/didcomm'
import type { ActionMenuProblemReportReason } from './ActionMenuProblemReportReason'

import { DidCommProblemReportError } from '@credo-ts/didcomm'

import { ActionMenuProblemReportMessage } from '../messages'

/**
 * @internal
 */
interface ActionMenuProblemReportErrorOptions extends DidCommProblemReportErrorOptions {
  problemCode: ActionMenuProblemReportReason
}

/**
 * @internal
 */
export class ActionMenuProblemReportError extends DidCommProblemReportError {
  public problemReport: ActionMenuProblemReportMessage

  public constructor(
    public message: string,
    { problemCode }: ActionMenuProblemReportErrorOptions
  ) {
    super(message, { problemCode })
    this.problemReport = new ActionMenuProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
