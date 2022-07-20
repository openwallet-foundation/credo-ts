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
      defaultTransport: Transports.HTTP,
      verifiableNotes: createVerifiableNotes(10),
    }
    const witness = new Witness(
      'witness',
      undefined,
      [Transports.HTTP],
      valueTransferConfig,
      'http://localhost:3000/api/v1?oob=eyJ0eXAiOiJhcHBsaWNhdGlvbi9kaWRjb21tLXBsYWluK2pzb24iLCJpZCI6IjMyNGJiODQzLWFlOTYtNDBlOC04OTIzLWZiZDkwOGE3YTIwNCIsImZyb20iOiJkaWQ6cGVlcjoyLkV6NkxTcUpmbjdmeW15TE5SM0Fxc1VXbzEzZTMxc3JRcGFMOUYxb2NVbk5hc1VwOVYuVno2TWtwQnRSUGt1M0dVbUtqeU5DV2YyQnR4U0JoTmlGTWtTeGtBSlpzNnlXY24yeS5TZXlKeklqb2lhSFIwY0RvdkwyeHZZMkZzYUc5emREb3pNREF3TDJGd2FTOTJNU0lzSW5RaU9pSmtiU0lzSW5JaU9sdGRMQ0poSWpwYkltUnBaR052YlcwdmRqSWlYWDAiLCJib2R5Ijp7ImdvYWxfY29kZSI6Im1lZGlhdG9yLXByb3Zpc2lvbiJ9LCJ0eXBlIjoiaHR0cHM6Ly9kaWRjb21tLm9yZy9vdXQtb2YtYmFuZC8yLjAvaW52aXRhdGlvbiJ9'
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
