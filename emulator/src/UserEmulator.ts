import type { InitConfig } from '@aries-framework/core'

import { Agent, DidMarker, HttpOutboundTransport, Transports, InjectionSymbols } from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import { randomUUID } from 'crypto'
import { MetricsService } from './metrics'

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
  private metricsService: MetricsService
  private config: EmulatorUserConfig
  private static amount = 1

  public constructor(userConfig: EmulatorUserConfig) {
    const name = userConfig.label ?? randomUUID()
    const endpoint = `${userConfig.host}:${userConfig.port!}`

    this.metricsService = new MetricsService()

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
      metricsService: this.metricsService,
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

      const transactionId = randomUUID()

      await this.metricsService.reportGossipStart(this.agent.config.label, transactionId)
      await this.agent.valueTransfer.mintCash({ amount: User.amount, waitForAck: false })
      await this.metricsService.reportGossipCompleted(this.agent.config.label, transactionId)
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
