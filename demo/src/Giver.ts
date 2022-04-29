/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core/src/modules/value-transfer'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'
import { JsonEncoder } from '@aries-framework/core/src/utils'

import { BaseAgent } from './BaseAgent'
import { greenText, Output } from './OutputClass'

export class Giver extends BaseAgent {
  public connectionRecordFWitnessId?: string

  public constructor(port: number, name: string, valueTransferConfig: ValueTransferConfig) {
    super(port, name, valueTransferConfig)
  }

  public static async build(): Promise<Giver> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Giver,
    }
    const giver = new Giver(9001, 'giver', valueTransferConfig)
    await giver.initializeAgent()
    return giver
  }

  public async setupConnection() {
    await this.printConnectionInvite()
  }

  private async printConnectionInvite() {
    const invite = await this.agent.connections.createOutOfBandConnection({
      goalCode: 'pay.cash.vtp',
      accept: ['didcomm/v2'],
    })
    this.connectionRecordFWitnessId = invite.connectionRecord.id
    console.log(Output.ConnectionLink, JsonEncoder.toString(invite.invitation), '\n')
    return invite.invitation
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    await this.agent.valueTransfer.acceptPaymentRequest(valueTransferRecord.id)
    console.log(greenText('\nPayment request accepted!\n'))
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
