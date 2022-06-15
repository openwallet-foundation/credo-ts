import type { InboundTransport, Agent } from '@aries-framework/core'
import type { FileSystem } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'
import { JsonEncoder } from '@aries-framework/core/build/utils/JsonEncoder'
import { sleep } from '@aries-framework/core/build/utils/sleep'

export class FileInboundTransport implements InboundTransport {
  private FileSystem!: FileSystem
  private alias: string
  private file: string

  public constructor({ schema, alias }: { schema: string; alias: string }) {
    this.file = `${schema}.json`
    this.alias = alias
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
            await agent.receiveMessage(message, undefined)
          }
        }
      }
      await sleep(50)
    }
  }

  public async stop(): Promise<void> {
    return
  }
}
