/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ConnectionRecord } from '@aries-framework/core'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'

import { BaseAgent } from './BaseAgent'
import { greenText, Output } from './OutputClass'

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

  private async receiveConnectionRequest(invitationUrl: string) {
    return await this.agent.connections.receiveInvitationFromUrl(invitationUrl)
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(greenText(Output.ConnectionEstablished))
    return connectionRecord.id
  }

  public async acceptGetterConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordGetterId = await this.waitForConnection(connectionRecord)
  }

  public async acceptGiverConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordGiverId = await this.waitForConnection(connectionRecord)
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
