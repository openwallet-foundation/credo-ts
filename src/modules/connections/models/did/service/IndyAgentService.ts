import { ArrayNotEmpty, IsOptional, IsString } from 'class-validator'
import { Service } from './Service'

export class IndyAgentService extends Service {
  public constructor(options: {
    id: string
    serviceEndpoint: string
    recipientKeys: string[]
    routingKeys?: string[]
    priority?: number
  }) {
    super({ ...options, type: 'IndyAgent' })

    if (options) {
      this.recipientKeys = options.recipientKeys
      this.routingKeys = options.routingKeys
      if (options.priority) this.priority = options.priority
    }
  }

  public type = 'IndyAgent'

  @ArrayNotEmpty()
  @IsString({ each: true })
  public recipientKeys!: string[]

  @IsString({ each: true })
  @IsOptional()
  public routingKeys?: string[]

  public priority = 0
}
