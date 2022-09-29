import type { ProblemReportV2MessageOptions } from '../../problem-reports'

import { ProblemReport } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals } from 'class-validator'

import { ProblemReportV2Message } from '../../problem-reports'

export class ProblemReportMessage extends ProblemReportV2Message {
  public constructor(options?: ProblemReportV2MessageOptions) {
    super(options)
  }

  @Equals(ProblemReportMessage.type)
  public readonly type = ProblemReportMessage.type
  public static readonly type = ProblemReport.type
}
