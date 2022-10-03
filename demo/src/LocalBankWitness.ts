/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import { DidMarker, Transports } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class LocalBankWitness extends BaseAgent {
  public static wid = '3'
  public static host = 'http://localhost'

  public constructor(name: string, port?: number) {
    const endpoint = `${LocalBankWitness.host}:${port}`
    super({
      name,
      port,
      transports: [Transports.HTTP],
      staticDids: [
        {
          seed: '6b8b882e2618fa5d45ee7229ca880089',
          transports: [Transports.HTTP],
          marker: DidMarker.Public,
          endpoint,
        },
      ],
      valueTransferConfig: {
        witness: {
          wid: LocalBankWitness.wid,
          knownWitnesses: BaseAgent.witnessTable,
        },
      },
    })
  }

  public static async build(): Promise<LocalBankWitness> {
    const witness = new LocalBankWitness('localBank', 8083)
    await witness.initializeAgent()
    const publicDid = await witness.agent.getStaticDid(DidMarker.Public)
    console.log(`LocalBank Public DID: ${publicDid?.did}`)
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
