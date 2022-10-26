/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core'

import { DidMarker, Transports } from '@aries-framework/core'
import { TransactionState } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class CentralBankIssuer extends BaseAgent {
  public valueTransferRecordId?: string
  private static readonly witnessDid =
    'did:peer:2.Ez6LSfsT5gHMCVEya8VDwW9QbAdVUhJCKbVscrrb82SwCPKKT.Vz6MkgNdE8ad1k8cPCHnXZ6vSxrTuFauRKDzzUHLPvdsLycz5.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgxIiwidCI6ImRtIiwiciI6W119'

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.HTTP, Transports.WS],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: 'ade127f2fb0b4ee3bf846f63b6006183',
          transports: [Transports.HTTP, Transports.WS],
          marker: DidMarker.Public,
        },
      ],
      valueTransferConfig: {},
    })
  }

  public static async build(): Promise<CentralBankIssuer> {
    const centralBankIssuer = new CentralBankIssuer('centralBankIssuer', undefined)
    await centralBankIssuer.initializeAgent()
    const publicDid = await centralBankIssuer.agent.getStaticDid(DidMarker.Public)
    console.log(`CentralBankIssuer Public DID: ${publicDid?.did}`)

    const active = await centralBankIssuer.agent.valueTransfer.getActiveTransaction()
    if (active.record?.id) {
      await centralBankIssuer.agent.valueTransfer.abortTransaction(active.record?.id)
    }

    const trustPing = await centralBankIssuer.agent.connections.sendTrustPing(CentralBankIssuer.witnessDid)
    console.log('AWAIT')
    await centralBankIssuer.agent.connections.awaitTrustPingResponse(trustPing.id)
    console.log(`Trust Ping response received from the Witness`)

    await centralBankIssuer.agent.valueTransfer.mintCash(10, CentralBankIssuer.witnessDid)

    const balance = await centralBankIssuer.agent.valueTransfer.getBalance()
    console.log(`CentralBankIssuer Balance: ${balance}`)

    return centralBankIssuer
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.acceptPaymentRequest({ recordId: valueTransferRecord.id })
    this.valueTransferRecordId = record?.id
    console.log(greenText('\nPayment request accepted!\n'))
    await this.waitForPayment()
  }

  private async getValueTransferRecord() {
    if (!this.valueTransferRecordId) {
      throw Error(redText(Output.MissingValueTransferRecord))
    }
    return await this.agent.valueTransfer.getById(this.valueTransferRecordId)
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for finishing payment...')
    try {
      const record = await this.agent.valueTransfer.returnWhenIsCompleted(valueTransferRecord.id)
      if (record.state === TransactionState.Completed) {
        console.log(greenText(Output.PaymentDone))
        console.log(greenText('Receipt:'))
        console.log(record.receipt)
        const balance = await this.agent.valueTransfer.getBalance()
        console.log(greenText('Balance: ' + balance))
      }
      if (record.state === TransactionState.Failed) {
        console.log(redText('Payment Failed:'))
        console.log(record.error)
      }
    } catch (e) {
      console.log(redText(`\nTimeout of 120 seconds reached.. Returning to home screen.\n`))
      return
    }
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
