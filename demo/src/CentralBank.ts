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
        {
          seed: '6b8b882e2618fa5d45ee7229ca880086',
          transports: [Transports.HTTP],
          marker: DidMarker.Restricted,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid: CentralBank.wid,
          knownWitnesses: BaseAgent.witnessTable,
          issuerDids: [
            'did:peer:2.Ez6LSgzMiffdvz75iwtDzU9U23YnUsVGWqsZRfpXZf43G1qMw.Vz6MkiRNEoPQFYs3Cm9x3Xbx3Q4MRJTXVbGwpcMDkrRK6JTYD.SeyJzIjoiaHR0cDovLzE5Mi4xNjguMS4xNDU6MzAwMC9hcGkvdjEiLCJ0IjoiZG0iLCJyIjpbImRpZDpwZWVyOjIuRXo2TFNuSFM5ZjNock11THJOOXo2WmhvN1RjQlJ2U3lLN0hQalF0d0ttdTNvc1d3Ri5WejZNa3JhaEFvVkxRUzlTNUdGNXNVS3R1ZFhNZWRVU1pkZGVKaGpIdEFGYVY0aG9WLlNXM3NpY3lJNkltaDBkSEE2THk4eE9USXVNVFk0TGpFdU1UUTFPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTE5TEhzaWN5STZJbmR6T2k4dk1Ua3lMakUyT0M0eExqRTBOVG96TURBd0wyRndhUzkyTVNJc0luUWlPaUprYlNJc0luSWlPbHRkZlYwIl19',
          ],
        },
      },
    })
  }

  public static async build(): Promise<CentralBank> {
    const witness = new CentralBank('centralBank', undefined)
    await witness.initializeAgent()
    const publicDid = await witness.agent.getStaticDid(DidMarker.Online)
    console.log(`CentralBank Public DID: ${publicDid?.did}`)

    const gossipDid = await witness.agent.getStaticDid(DidMarker.Restricted)
    console.log(`CentralBank Gossip DID: ${gossipDid?.did}`)
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
