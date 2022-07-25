/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferConfig } from '@aries-framework/core'

import { Transports } from '@aries-framework/core'
import { createVerifiableNotes } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class Witness extends BaseAgent {
  public static seed = '6b8b882e2618fa5d45ee7229ca880083'

  public constructor(
    name: string,
    port?: number,
    transports?: Transports[],
    valueTransferConfig?: ValueTransferConfig,
    mediatorConnectionsInvite?: string
  ) {
    super(name, Witness.seed, port, transports, valueTransferConfig, mediatorConnectionsInvite)
  }

  public static async build(): Promise<Witness> {
    const valueTransferConfig: ValueTransferConfig = {
      isWitness: true,
      // defaultTransport: Transports.NFC,
      defaultTransport: Transports.HTTP,
      verifiableNotes: createVerifiableNotes(10),
    }
    // const witness = new Witness('witness', undefined, [Transports.NFC, Transports.IPC], valueTransferConfig)
    const witness = new Witness(
      'witness',
      undefined,
      [Transports.NFC, Transports.IPC, Transports.HTTP],
      valueTransferConfig,
      BaseAgent.defaultMediatorConnectionInvite
    )
    await witness.initializeAgent()
    const publicDid = await witness.agent.getPublicDid()
    console.log(`Witness Public DID: ${publicDid?.did}`)
    return witness
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
