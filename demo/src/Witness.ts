/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import { DidMarker, Transports } from '@aries-framework/core'
import { createVerifiableNotes } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class Witness extends BaseAgent {
  public static seed = '6b8b882e2618fa5d45ee7229ca880083'

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.NFC, Transports.IPC, Transports.HTTP],
      defaultTransport: Transports.NFC,
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880084',
          transports: [Transports.NFC, Transports.IPC, Transports.HTTP],
          marker: DidMarker.Online,
        },
      ],
      valueTransferConfig: {
        isWitness: true,
        verifiableNotes: createVerifiableNotes(10),
      },
    })
  }

  public static async build(): Promise<Witness> {
    const witness = new Witness('witness', undefined)
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
