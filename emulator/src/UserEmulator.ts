import type { InitConfig } from '@aries-framework/core'

import { Agent, DidMarker, HttpOutboundTransport, Transports } from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import { randomUUID } from 'crypto'

export interface EmulatorUserConfig {
  host?: string
  port?: number
  label?: string
  interval?: number
  witnessIndex?: number
  witness?: string
  publicDidSeed?: string
}

export class User {
  private agent: Agent
  private config: EmulatorUserConfig
  private static amount = 1

  public constructor(userConfig: EmulatorUserConfig) {
    const name = userConfig.label ?? randomUUID()
    const endpoint = `${userConfig.host}:${userConfig.port!}`
    const config: InitConfig = {
      label: name,
      walletConfig: { id: name, key: name },
      staticDids: [
        {
          seed: userConfig.publicDidSeed,
          marker: DidMarker.Online,
          endpoint,
          transports: [Transports.HTTP],
          needMediation: false,
        },
      ],
      valueTransferConfig: {
        party: {
          witnessDid: userConfig.witness,
        },
      },
      transports: [Transports.HTTP],
    }

    this.agent = new Agent(config, agentDependencies)
    this.agent.registerInboundTransport(new HttpInboundTransport({ port: userConfig.port! }))
    this.agent.registerOutboundTransport(new HttpOutboundTransport())

    this.config = userConfig
  }

  public async run() {
    await this.agent.initialize()
    console.log(`User ${this.agent.config.label} started!`)
    setInterval(async () => {
      console.log(`User ${this.agent.config.label} trigger message`)
      await this.agent.valueTransfer.mintCash({ amount: User.amount, waitForAck: false })
    }, this.config.interval || 1000 * 3)
  }
}

export class UserEmulator {
  private users: User[] = []

  constructor(users: EmulatorUserConfig[]) {
    this.users = users.map((userConfig) => new User(userConfig))
  }

  public run = async () => {
    Promise.all(this.users.map((user) => user.run()))
  }
}
