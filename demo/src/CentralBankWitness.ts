/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import { DidMarker, Transports } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class CentralBankWitness extends BaseAgent {
  public static wid = '1'
  public static host = 'http://localhost'

  public constructor(name: string, port?: number) {
    const endpoint = `${CentralBankWitness.host}:${port}`
    super({
      name,
      port,
      transports: [Transports.HTTP],
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880085',
          transports: [Transports.HTTP],
          marker: DidMarker.Public,
          endpoint,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid: CentralBankWitness.wid,
          knownWitnesses: BaseAgent.witnessTable,
          issuerDids: [
            'did:peer:2.Ez6LSgzMiffdvz75iwtDzU9U23YnUsVGWqsZRfpXZf43G1qMw.Vz6MkiRNEoPQFYs3Cm9x3Xbx3Q4MRJTXVbGwpcMDkrRK6JTYD.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFgwc2V5SnpJam9pZDNNNkx5OXNiMk5oYkdodmMzUTZNekF3TUM5aGNHa3ZkakVpTENKMElqb2laRzBpTENKeUlqcGJYWDFkIl19',
          ],
        },
      },
    })
  }

  public static async build(): Promise<CentralBankWitness> {
    const witness = new CentralBankWitness('centralBank', 8081)
    await witness.initializeAgent()
    const publicDid = await witness.agent.getStaticDid(DidMarker.Public)
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
