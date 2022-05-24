import type { InboundTransport, Agent, Transport } from '@aries-framework/core'
import type { FileSystem } from '@aries-framework/core/src/storage/FileSystem'

import { AgentConfig } from '@aries-framework/core'
import { JsonEncoder } from '@aries-framework/core/src/utils'
import { sleep } from '@aries-framework/core/src/utils/sleep'

export class FileInboundTransport implements InboundTransport {
  private FileSystem!: FileSystem
  private alias: string
  private file: string
  private transport: Transport

  public constructor({ schema, alias }: { schema: string; alias: string }) {
    this.file = `${schema}.json`
    this.alias = alias
    this.transport = schema as Transport
  }

  public async start(agent: Agent) {
    const config = agent.injectionContainer.resolve(AgentConfig)
    this.FileSystem = new config.agentDependencies.FileSystem()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const fileExists = await this.FileSystem.exists(this.file)
      if (fileExists) {
        const message = await this.FileSystem.read(this.file)
        const data = JsonEncoder.fromString(message)
        for (const alias of Object.keys(data)) {
          if (this.alias !== alias && data[alias]) {
            const message = data[alias]
            const newData = JsonEncoder.toString({
              [alias]: undefined,
            })
            await this.FileSystem.write(this.file, newData)
            await agent.receiveMessage(message, undefined, this.transport)
          }
        }
      }
      await sleep(3000)
    }
  }

  public async stop(): Promise<void> {
    return
  }
}
