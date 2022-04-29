/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { JsonTransformer } from '@aries-framework/core'
import { OutOfBandInvitationMessage } from '@aries-framework/core/src/modules/connections/messages/OutOfBandInvitationMessage'
import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'
import { JsonEncoder } from '@aries-framework/core/src/utils'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class Witness extends BaseAgent {
  public connectionRecordGetterId?: string
  public connectionRecordGiverId?: string

  public constructor(port: number, name: string, valueTransferConfig: ValueTransferConfig) {
    super(port, name, valueTransferConfig)
  }

  public static async build(): Promise<Witness> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Witness,
    }
    const witness = new Witness(9002, 'witness', valueTransferConfig)
    await witness.initializeAgent()
    return witness
  }

  public async acceptGetterConnection(invitationJSON: string) {
    this.connectionRecordGetterId = (await this.acceptConnection(invitationJSON)).connectionRecord.id
  }

  public async acceptGiverConnection(invitationJSON: string) {
    this.connectionRecordGiverId = (await this.acceptConnection(invitationJSON)).connectionRecord.id
  }

  public async acceptConnection(invitationJSON: string) {
    const invitation = JsonTransformer.fromJSON(JsonEncoder.fromString(invitationJSON), OutOfBandInvitationMessage)
    return this.agent.connections.acceptOutOfBandInvitation(invitation)
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
