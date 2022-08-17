/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import { DidMarker, Transports } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class LocalBank extends BaseAgent {
  public static wid = '3'

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.HTTP, Transports.WS],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880089',
          transports: [Transports.HTTP, Transports.WS],
          marker: DidMarker.Online,
        },
        {
          seed: '6b8b882e2618fa5d45ee7229ca880090',
          transports: [Transports.HTTP],
          marker: DidMarker.Restricted,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid: LocalBank.wid,
          knownWitnesses: BaseAgent.witnessTable,
        },
      },
    })
  }

  public static async build(): Promise<LocalBank> {
    const witness = new LocalBank('localBank', undefined)
    await witness.initializeAgent()
    const publicDid = await witness.agent.getStaticDid(DidMarker.Online)
    console.log(`LocalBank Public DID: ${publicDid?.did}`)

    const gossipDid = await witness.agent.getStaticDid(DidMarker.Restricted)
    console.log(`LocalBank Gossip DID: ${gossipDid?.did}`)
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
