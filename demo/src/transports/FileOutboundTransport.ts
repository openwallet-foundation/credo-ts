import * as zlib from 'zlib'
var compressjs = require('compressjs')
import { Agent, AgentConfig, Logger, OutboundPackage, OutboundTransport } from '@aries-framework/core'
import { JsonEncoder } from '@aries-framework/core/build/utils/JsonEncoder'
import type { FileSystem } from '@aries-framework/core'

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
