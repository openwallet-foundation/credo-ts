/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { Transport } from '@aries-framework/core'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'

import { BaseAgent } from './BaseAgent'
import { Output } from './OutputClass'

export class Witness extends BaseAgent {
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

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
