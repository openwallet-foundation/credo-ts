/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ConnectionRecord, Transport } from '@aries-framework/core'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'

import { BaseAgent } from './BaseAgent'
import { greenText, Output } from './OutputClass'

export class Witness extends BaseAgent {
  public connectionRecordGetterId?: string
  public connectionRecordGiverId?: string
  public static transports: Transport[] = ['nfc', 'ipc']

  public constructor(
    name: string,
    port?: number,
    offlineTransports?: string[],
    valueTransferConfig?: ValueTransferConfig
  ) {
    super(name, port, offlineTransports, valueTransferConfig)
  }

  public static async build(): Promise<Witness> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Witness,
    }
    const witness = new Witness('witness', undefined, Witness.transports, valueTransferConfig)
    await witness.initializeAgent()
    return witness
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(greenText(Output.ConnectionEstablished))
    return connectionRecord.id
  }

  public async acceptGetterConnection(invitation_url: string) {
    const connectionRecord = await this.agent.connections.receiveInvitationFromUrl(invitation_url)
    this.connectionRecordGetterId = await this.waitForConnection(connectionRecord)
  }

  public async acceptGiverConnection(invitation_url: string) {
    const { connectionRecord } = await this.agent.connections.acceptOutOfBandInvitationFromUrl(invitation_url)
    this.connectionRecordGiverId = connectionRecord.id
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
