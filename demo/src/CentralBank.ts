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
            'did:peer:2.Ez6LSgzMiffdvz75iwtDzU9U23YnUsVGWqsZRfpXZf43G1qMw.Vz6MkiRNEoPQFYs3Cm9x3Xbx3Q4MRJTXVbGwpcMDkrRK6JTYD.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',
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
