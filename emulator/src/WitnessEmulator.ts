import type { InitConfig } from '@aries-framework/core'
import type { WitnessInfo } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Agent, DidMarker, HttpOutboundTransport, Transports } from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import { randomUUID } from 'crypto'

export interface EmulatorWitnessConfig {
  host?: string
  port?: number
  label?: string
  wid?: string
  type?: string
  issuerDids?: string[]
  publicDidSeed?: string
  gossipDidSeed?: string
  tockTime?: number
  knownWitnesses?: WitnessInfo[]
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
      staticDids: [
        {
          seed: witnessConfig.publicDidSeed,
          marker: DidMarker.Online,
          endpoint: endpoint,
          transports: [Transports.HTTP],
          needMediation: false,
        },
        {
          seed: witnessConfig.gossipDidSeed,
          marker: DidMarker.Restricted,
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
    const publicDid = await this.agent.getStaticDid(DidMarker.Online)
    console.log(`Witness ${this.agent.config.label} Public DID: ${publicDid?.did}`)
    const gossipDid = await this.agent.getStaticDid(DidMarker.Restricted)
    console.log(`Witness ${this.agent.config.label} Gossip DID: ${gossipDid?.did}`)
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
