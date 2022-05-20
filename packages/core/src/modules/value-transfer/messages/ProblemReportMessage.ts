import type { ProblemReportV2MessageOptions } from '../../problem-reports'

import { Equals } from 'class-validator'

import { ProblemReportV2Message } from '../../problem-reports'

export class ProblemReportMessage extends ProblemReportV2Message {
  public constructor(options?: ProblemReportV2MessageOptions) {
    super(options)
  }

  @Equals(ProblemReportMessage.type)
  public readonly type = ProblemReportMessage.type
  public static readonly type = 'https://didcomm.org/vtp/2.0/problem-report'
}
