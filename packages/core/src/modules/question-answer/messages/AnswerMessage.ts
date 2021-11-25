import { Expose } from 'class-transformer'
import { Equals, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export class AnswerMessage extends AgentMessage {
  /**
   * Create new AnswerMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { id?: string, response: string; threadId: string }) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.setThread({ threadId: options.threadId })
      this.response = options.response
    }
  }

  @Equals(AnswerMessage.type)
  public readonly type = AnswerMessage.type
  public static readonly type = 'https://didcomm.org/questionanswer/1.0/answer'

//   public validResponse: ValidResponse[string]

  @Expose({ name: 'response' })
  @IsString()
  public response!: string
}
