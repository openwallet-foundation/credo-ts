import type { InitConfig } from '@aries-framework/core'
import { Agent, ConsoleLogger, DidMarker, HttpOutboundTransport, LogLevel, Transports } from '@aries-framework/core'
import type { WitnessDetails } from '@sicpa-dlab/value-transfer-protocol-ts'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import { randomUUID } from 'crypto'
import { MetricsService } from './metrics'

export interface EmulatorWitnessConfig {
  host?: string
  port?: number
  label?: string
  wid?: string
  type?: string
  issuerDids?: string[]
  publicDidSeed?: string
  tockTime?: number
  knownWitnesses?: WitnessDetails[]
}

export class Witness {
  public agent: Agent
  public config: EmulatorWitnessConfig

  public constructor(witnessConfig: EmulatorWitnessConfig) {
    const name = witnessConfig.label ?? randomUUID()
    const endpoint = `${witnessConfig.host}:${witnessConfig.port!}`
    const wid = witnessConfig.wid ?? witnessConfig.port!.toString()

    const config: InitConfig = {
      label: name,
      walletConfig: { id: name, key: name },
      logger: new ConsoleLogger(LogLevel.error),
      staticDids: [
        {
          seed: witnessConfig.publicDidSeed,
          marker: DidMarker.Public,
          endpoint: endpoint,
          transports: [Transports.HTTP],
          needMediation: false,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid,
          knownWitnesses: witnessConfig.knownWitnesses || [],
          issuerDids: witnessConfig.issuerDids,
          tockTime: witnessConfig.tockTime,
          gossipMetricsService: new MetricsService(),
        },
      },
      transports: [Transports.HTTP],
    }

    this.agent = new Agent(config, agentDependencies)
    this.agent.registerInboundTransport(new HttpInboundTransport({ port: witnessConfig.port! }))
    this.agent.registerOutboundTransport(new HttpOutboundTransport())

    this.config = witnessConfig
  }

  public async run() {
    await this.agent.initialize()
    console.log(`Witness ${this.agent.config.label} started!`)
    const publicDid = await this.agent.getStaticDid(DidMarker.Public)
    console.log(`Witness ${this.agent.config.label} Public DID: ${publicDid?.did}`)
  }
}

export class WitnessEmulator {
  private witnesses: Witness[] = []

  constructor(witnesses: EmulatorWitnessConfig[]) {
    this.witnesses = witnesses.map((witnessConfig) => new Witness(witnessConfig))
  }

  public run = async () => {
    return Promise.all(this.witnesses.map((witness) => witness.run()))
  }
}
