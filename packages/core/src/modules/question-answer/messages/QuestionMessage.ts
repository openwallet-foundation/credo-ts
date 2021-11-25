import { Expose, Type } from 'class-transformer'
import { Equals, IsBoolean, IsInstance, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { ValidResponse } from '../models'

export class QuestionMessage extends AgentMessage {
  /**
   * Create new QuestionMessage instance.
   * @param options
   */
  public constructor(options: {
    questionText: string
    questionDetail?: string
    validResponses: ValidResponse[]
    signatureRequired: boolean
    id?: string
    nonce?: string
  }) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.nonce = options.nonce
      this.questionText = options.questionText
      this.questionDetail = options.questionDetail
      this.signatureRequired = options.signatureRequired
      this.validResponses = options.validResponses
    }
  }

  @Equals(QuestionMessage.type)
  public readonly type = QuestionMessage.type
  public static readonly type = 'https://didcomm.org/questionanswer/1.0/question'

  @IsString()
  public nonce?: string

  @IsBoolean()
  @Expose({ name: 'signature_required' })
  public signatureRequired!: boolean

  @Type(() => ValidResponse)
  @ValidateNested({ each: true })
  @IsInstance(ValidResponse, { each: true })
  public validResponses!: ValidResponse[]

  @Expose({ name: 'question_text' })
  @IsString()
  public questionText!: string

  @Expose({ name: 'question_detail' })
  @IsString()
  public questionDetail?: string
}
