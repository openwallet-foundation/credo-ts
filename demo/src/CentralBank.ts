/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import { DidMarker, Transports } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class CentralBank extends BaseAgent {
  public static wid = '1'

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.HTTP, Transports.WS],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880085',
          transports: [Transports.HTTP, Transports.WS],
          marker: DidMarker.Online,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid: CentralBank.wid,
          knownWitnesses: BaseAgent.witnessTable,
        },
      },
    })
  }

  public static async build(): Promise<CentralBank> {
    const witness = new CentralBank('centralBank', undefined)
    await witness.initializeAgent()
    const publicDid = await witness.agent.getPublicDid()
    console.log(`CentralBank Public DID: ${publicDid?.did}`)
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
