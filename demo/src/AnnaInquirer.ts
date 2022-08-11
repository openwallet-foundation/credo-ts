import type { ValueTransferRecord } from '@aries-framework/core'

import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { Anna } from './Anna'
import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Listener } from './Listener'
import { greenText, Title } from './OutputClass'

export const runGiver = async () => {
  clear()
  console.log(textSync('Anna', { horizontalLayout: 'full' }))
  const giver = await AnnaInquirer.build()
  await giver.processAnswer()
}

enum PromptOptions {
  OfferPay = 'Offer Payment',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class AnnaInquirer extends BaseInquirer {
  public giver: Anna
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(giver: Anna) {
    super()
    this.giver = giver
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.giver.agent, this.giver.name)
    this.listener.paymentRequestListener(this.giver, this)
  }

  public static async build(): Promise<AnnaInquirer> {
    const giver = await Anna.build()
    return new AnnaInquirer(giver)
  }

  private async getPromptChoice() {
    const balance = await this.giver.agent.valueTransfer.getBalance()
    console.log(greenText('Balance: ' + balance))
    return prompt([this.inquireOptions(this.promptOptionsString)])
  }

  public async processAnswer() {
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
    const getter = await prompt([this.inquireInput('Getter DID')])
    await this.giver.offerPayment(getter.input)
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const balance = await this.giver.agent.valueTransfer.getBalance()
    console.log(greenText(`\nCurrent balance: ${balance}`))
    const confirm = await prompt([this.inquireConfirmation(Title.PaymentRequestTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.giver.abortPaymentRequest(valueTransferRecord)
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.giver.acceptPaymentRequest(valueTransferRecord)
    }
  }

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.giver.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.giver.restart()
      await runGiver()
    }
  }
}

void runGiver()
