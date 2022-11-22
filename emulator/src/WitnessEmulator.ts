import type { InitConfig } from '@aries-framework/core'
import type { WitnessDetails } from '@sicpa-dlab/witness-gossip-types-ts'

import { Agent, ConsoleLogger, DidMarker, HttpOutboundTransport, LogLevel, Transports } from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport, initWitnessGossip } from '@aries-framework/node'
import { GossipStorageType } from '@sicpa-dlab/witness-gossip-types-ts'
import { randomUUID } from 'crypto'

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
    const endpoint = `${witnessConfig.host}:${witnessConfig.port}`
    const wid = witnessConfig.wid || witnessConfig.port?.toString() || ''

    const config: InitConfig = {
      label: name,
      walletConfig: { id: name, key: name },
      logger: new ConsoleLogger(LogLevel.debug),
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
          gossipConfig: { tockTimeMs: witnessConfig.tockTime },
        },
      },
      transports: [Transports.HTTP],
      gossipStorageConfig: { type: GossipStorageType.SQLite, connectionConfig: { dbName: `gossip-db-${name}` } },
    }

    this.agent = new Agent(config, agentDependencies)
    this.agent.registerInboundTransport(new HttpInboundTransport({ port: witnessConfig.port || 8000 }))
    this.agent.registerOutboundTransport(new HttpOutboundTransport())

    this.config = witnessConfig
  }

  public async run() {
    await this.agent.initialize()
    await initWitnessGossip(this.agent)
    console.log(`Witness ${this.agent.config.label} started!`)
    const publicDid = await this.agent.getStaticDid(DidMarker.Public)
    console.log(`Witness ${this.agent.config.label} Public DID: ${publicDid?.did}`)
  }
}

export class WitnessEmulator {
  private witnesses: Witness[] = []

  public constructor(witnesses: EmulatorWitnessConfig[]) {
    this.witnesses = witnesses.map((witnessConfig) => new Witness(witnessConfig))
  }

  public run = async () => {
    return Promise.all(this.witnesses.map((witness) => witness.run()))
  }
}
