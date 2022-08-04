/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import { DidMarker, Transports } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class GlobalBank extends BaseAgent {
  public static wid = '2'

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.HTTP],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880086',
          transports: [Transports.HTTP],
          marker: DidMarker.Online,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid: GlobalBank.wid,
          knownWitnesses: BaseAgent.witnessTable,
          supportedPartiesCount: 0,
        },
      },
    })
  }

  public static async build(): Promise<GlobalBank> {
    const witness = new GlobalBank('globalBank', undefined)
    await witness.initializeAgent()
    const publicDid = await witness.agent.getPublicDid()
    console.log(`GlobalBank Public DID: ${publicDid?.did}`)
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
