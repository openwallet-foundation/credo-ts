// Create a base ProblemReportMessage message class and add it to the messages directory
import { Equals, IsEnum, IsOptional, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { CommonMessageType } from '../../common/messages/CommonMessageType'

export enum WhoRetriesStatus {
  YOU = 'YOU',
  ME = 'ME',
  BOTH = 'BOTH',
  NONE = 'NONE',
}

export enum ImpactStatus {
  MESSAGE = 'MESSAGE',
  THREAD = 'THREAD',
  CONNECTION = 'CONNECTION',
}

export enum WhereStatus {
  CLOUD = 'CLOUD',
  EDGE = 'EDGE',
  WIRE = 'WIRE',
  AGENCY = 'AGENCY',
}

export enum OtherStatus {
  YOU = 'YOU',
  ME = 'ME',
  OTHER = 'OTHER',
}

export interface DescriptionOptions {
  en: string
  code: string
}

export interface FixHintOptions {
  en: string
}

export interface ProblemReportMessageOptions {
  id?: string
  description: DescriptionOptions
  problem_items?: string[]
  who_retries?: WhoRetriesStatus
  fix_hint?: FixHintOptions
  impact?: ImpactStatus
  where?: WhereStatus
  noticed_time?: string
  tracking_uri?: string
  escalation_uri?: string
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class ProblemReportMessage extends AgentMessage {
  /**
   * Create new ReportProblem instance.
   * @param options
   */
  public constructor(options: ProblemReportMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.description = options.description
      this.problem_items = options.problem_items
      this.who_retries = options.who_retries
      this.fix_hint = options.fix_hint
      this.impact = options.impact
      this.where = options.where
      this.noticed_time = options.noticed_time
      this.tracking_uri = options.tracking_uri
      this.escalation_uri = options.escalation_uri
    }
  }

  @Equals(ProblemReportMessage.type)
  public readonly type: string = ProblemReportMessage.type
  public static readonly type: string = CommonMessageType.ProblemReport

  public description!: DescriptionOptions

  @IsOptional()
  public problem_items?: string[]

  @IsOptional()
  @IsEnum(WhoRetriesStatus)
  public who_retries?: WhoRetriesStatus

  @IsOptional()
  public fix_hint?: FixHintOptions

  @IsOptional()
  @IsEnum(WhereStatus)
  public where?: WhereStatus

  @IsOptional()
  @IsEnum(ImpactStatus)
  public impact?: ImpactStatus

  @IsOptional()
  @IsString()
  public noticed_time?: string

  @IsOptional()
  @IsString()
  public tracking_uri?: string

  @IsOptional()
  @IsString()
  public escalation_uri?: string
}
