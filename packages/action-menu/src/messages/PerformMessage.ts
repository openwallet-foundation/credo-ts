import { AgentMessage, parseMessageType, utils } from '@credo-ts/core'
import { z } from 'zod'

const performMessageSchema = z.object({
  id: z.string().default(utils.uuid()),

  // TODO(zod): validate the name like is done in `@IsValidMessageType(PerformMessage.type)`
  name: z.string(),
  params: z.record(z.string()).optional(),
  threadId: z.string(),
})

export type PerformMessageOptions = z.input<typeof performMessageSchema>

export class PerformMessage extends AgentMessage {
  public readonly type = PerformMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/action-menu/1.0/perform')

  public name: string
  public params?: Record<string, string>

  public constructor(options: PerformMessageOptions) {
    super()

    const parsedOptions = performMessageSchema.parse(options)
    this.id = parsedOptions.id
    this.name = parsedOptions.name
    this.params = parsedOptions.params
    this.setThread({
      threadId: parsedOptions.threadId,
    })
  }
}
