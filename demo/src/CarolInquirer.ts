import type { ValueTransferRecord } from '@aries-framework/core'

import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Carol } from './Carol'
import { Listener } from './Listener'
import { greenText, Title } from './OutputClass'

export const runGetter = async () => {
  clear()
  console.log(textSync('Carol', { horizontalLayout: 'full' }))
  const getter = await CarolInquirer.build()
  await getter.processAnswer()
}

enum PromptOptions {
  RequestPayment = 'Request payment',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class CarolInquirer extends BaseInquirer {
  public getter: Carol
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(getter: Carol) {
    super()
    this.getter = getter
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.getter.agent, this.getter.name)
    this.listener.paymentOfferListener(this.getter, this)
  }

  public static async build(): Promise<CarolInquirer> {
    const getter = await Carol.build()
    return new CarolInquirer(getter)
  }

  private async getPromptChoice() {
    return prompt([this.inquireOptions(this.promptOptionsString)])
  }

  public async processAnswer() {
    const choice = await this.getPromptChoice()
    if (this.listener.on) return

    switch (choice.options) {
      case PromptOptions.RequestPayment:
        await this.requestPayment()
        return
      case PromptOptions.Exit:
        await this.exit()
        break
      case PromptOptions.Restart:
        await this.restart()
        return
    }
    await this.processAnswer()
  }

  public async requestPayment() {
    const witness = await prompt([this.inquireInput('Witness DID')])
    await this.getter.requestPayment(witness.input)
  }

  public async acceptPaymentOffer(valueTransferRecord: ValueTransferRecord) {
    const balance = await this.getter.agent.valueTransfer.getBalance()
    console.log(greenText(`\nCurrent balance: ${balance}`))
    const confirm = await prompt([this.inquireConfirmation(Title.PaymentOfferTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.getter.abortPaymentOffer(valueTransferRecord)
    } else if (confirm.options === ConfirmOptions.Yes) {
      const witness = await prompt([this.inquireInput('Witness DID')])
      await this.getter.acceptPaymentOffer(valueTransferRecord, witness.input)
    }
  }

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.getter.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.getter.restart()
      await runGetter()
    }
  }
}

void runGetter()
