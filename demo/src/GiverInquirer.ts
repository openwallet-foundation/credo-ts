import type { ValueTransferRecord } from '@aries-framework/core'

import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Giver } from './Giver'
import { Listener } from './Listener'
import { greenText, Title } from './OutputClass'

export const runFaber = async () => {
  clear()
  console.log(textSync('Giver', { horizontalLayout: 'full' }))
  const giver = await GiverInquirer.build()
  await giver.processAnswer()
}

enum PromptOptions {
  OfferPay = 'Offer Payment',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class GiverInquirer extends BaseInquirer {
  public giver: Giver
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(giver: Giver) {
    super()
    this.giver = giver
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.giver.agent, this.giver.name)
  }

  public static async build(): Promise<GiverInquirer> {
    const giver = await Giver.build()
    return new GiverInquirer(giver)
  }

  private async getPromptChoice() {
    const balance = await this.giver.agent.valueTransfer.getBalance()
    console.log(greenText('Balance: ' + balance))
    return inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
  }

  public async processAnswer() {
    this.listener.paymentRequestListener(this.giver, this)

    const choice = await this.getPromptChoice()
    if (this.listener.on) return

    switch (choice.options) {
      case PromptOptions.OfferPay:
        await this.offerPayment()
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

  public async offerPayment() {
    const getter = await inquirer.prompt([this.inquireInput('Getter DID')])
    await this.giver.offerPayment(getter.input)
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const balance = await this.giver.agent.valueTransfer.getBalance()
    console.log(greenText(`\nCurrent balance: ${balance}`))
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.PaymentRequestTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.giver.abortPaymentRequest(valueTransferRecord)
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.giver.acceptPaymentRequest(valueTransferRecord)
    }
  }

  public async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.giver.exit()
    }
  }

  public async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.giver.restart()
      await runFaber()
    }
  }
}

void runFaber()
