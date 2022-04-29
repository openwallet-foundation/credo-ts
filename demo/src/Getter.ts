/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'
import { JsonEncoder } from '@aries-framework/core/src/utils'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Getter extends BaseAgent {
  public connectionRecordWitnessId?: string

  public constructor(port: number, name: string, valueTransferConfig: ValueTransferConfig) {
    super(port, name, valueTransferConfig)
  }

  public static async build(): Promise<Getter> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Getter,
    }
    const getter = new Getter(9000, 'getter', valueTransferConfig)
    await getter.initializeAgent()
    return getter
  }

  private async printConnectionInvite() {
    const invite = await this.agent.connections.createOutOfBandConnection({
      goalCode: 'pay.cash.vtp',
      accept: ['didcomm/v2'],
    })
    this.connectionRecordWitnessId = invite.connectionRecord.id
    console.log(Output.ConnectionLink, JsonEncoder.toString(invite.connectionRecord.didDoc), '\n')
    console.log(Output.ConnectionLink, JsonEncoder.toString(invite.invitation), '\n')
    return invite.connectionRecord
  }

  public async setupConnection() {
    await this.printConnectionInvite()
  }

  public async requestPayment(giver: string) {
    if (!this.connectionRecordWitnessId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    await this.agent.valueTransfer.requestPayment(this.connectionRecordWitnessId, 10, giver)
    console.log(greenText('\nCredential offer accepted!\n'))
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
