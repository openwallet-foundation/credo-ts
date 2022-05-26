/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { Transport } from '@aries-framework/core'
import type { OutOfBandRecord } from '@aries-framework/core/src/modules/oob/repository'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { OutOfBandGoalCodes } from '@aries-framework/core/src/modules/oob/OutOfBandGoalCodes'
import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class Witness extends BaseAgent {
  public static transports: Transport[] = ['nfc', 'ipc']
  public static getterTransport: Transport = 'ipc'
  public static giverTransport: Transport = 'nfc'
  public static seed = '6b8b882e2618fa5d45ee7229ca880083'

  public constructor(
    name: string,
    port?: number,
    offlineTransports?: string[],
    valueTransferConfig?: ValueTransferConfig
  ) {
    super(name, Witness.seed, port, offlineTransports, valueTransferConfig)
  }

  public static async build(): Promise<Witness> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Witness,
    }
    const witness = new Witness('witness', undefined, Witness.transports, valueTransferConfig)
    await witness.initializeAgent()
    return witness
  }

  public async handleOutOBandInvitation(outOfBandRecord: OutOfBandRecord) {
    if (outOfBandRecord.invitation.body.goalCode === OutOfBandGoalCodes.RequestPayCashVtp) {
      console.log('\nForward Invitation')
      await this.agent.oob.sendInvitation(outOfBandRecord, {
        transport: Witness.giverTransport,
      })
      await this.agent.oob.complete(outOfBandRecord)
    }
    if (outOfBandRecord.invitation.body.goalCode === OutOfBandGoalCodes.PayCashVtp) {
      console.log('\nAccept and Forward Invitation')
      await this.agent.oob.acceptOutOfBandInvitation(outOfBandRecord, {
        transport: Witness.giverTransport,
      })
      await this.agent.oob.sendInvitation(outOfBandRecord, {
        transport: Witness.getterTransport,
      })
    }
    await this.agent.oob.complete(outOfBandRecord)
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
