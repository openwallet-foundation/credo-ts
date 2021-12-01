import type { PresentationProblemReportReason } from './PresentationProblemReportReason'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'

export class PresentationProblemReportError extends AriesFrameworkError {
  public constructor(public message: string, public problemCode: PresentationProblemReportReason) {
    super(message)
  }
}
