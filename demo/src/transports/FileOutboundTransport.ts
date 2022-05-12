import type { Agent } from '@aries-framework/core/src/agent/Agent'
import type { Logger } from '@aries-framework/core/src/logger'
import type { FileSystem } from '@aries-framework/core/src/storage/FileSystem'
import type { OutboundTransport } from '@aries-framework/core/src/transport/OutboundTransport'
import type { OutboundPackage } from '@aries-framework/core/src/types'

import { AgentConfig } from '@aries-framework/core/src/agent/AgentConfig'
import { JsonEncoder } from '@aries-framework/core/src/utils'

export class FileOutboundTransport implements OutboundTransport {
  private agent!: Agent
  private logger!: Logger
  private agentConfig!: AgentConfig
  private FileSystem!: FileSystem
  private alias: string
  private file: string

  public supportedSchemes: string[]

  public constructor({ schema, alias }: { schema: string; alias: string }) {
    this.supportedSchemes = [schema]
    this.file = `${schema}.json`
    this.alias = alias
  }

  public async start(agent: Agent): Promise<void> {
    this.agent = agent
    this.agentConfig = agent.injectionContainer.resolve(AgentConfig)
    this.logger = this.agentConfig.logger
    this.FileSystem = new this.agentConfig.agentDependencies.FileSystem()
    this.logger.debug('Starting File outbound transport')
  }

  public async stop(): Promise<void> {
    this.logger.debug('Stopping File outbound transport')
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const data = JsonEncoder.toString({
      [this.alias]: outboundPackage.payload,
    })
    await this.FileSystem.write(this.file, data)
  }
}
