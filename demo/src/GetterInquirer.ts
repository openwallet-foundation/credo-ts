import type { ValueTransferRecord } from '@aries-framework/core'

import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Getter } from './Getter'
import { Listener } from './Listener'
import { greenText, Title } from './OutputClass'

export const runGetter = async () => {
  clear()
  console.log(textSync('Getter', { horizontalLayout: 'full' }))
  const getter = await GetterInquirer.build()
  await getter.processAnswer()
}

enum PromptOptions {
  RequestPayment = 'Request payment',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class GetterInquirer extends BaseInquirer {
  public getter: Getter
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(getter: Getter) {
    super()
    this.getter = getter
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.getter.agent, this.getter.name)
    this.listener.paymentOfferListener(this.getter, this)
  }

  public static async build(): Promise<GetterInquirer> {
    const getter = await Getter.build()
    return new GetterInquirer(getter)
  }

  private async getPromptChoice() {
    return inquirer.prompt([this.inquireOptions(this.promptOptionsString)])
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
    const giver = await inquirer.prompt([this.inquireInput('Giver DID')])
    const witness = await inquirer.prompt([this.inquireInput('Witness DID')])
    await this.getter.requestPayment(giver.input, witness.input)
  }

  public async acceptPaymentOffer(valueTransferRecord: ValueTransferRecord) {
    const balance = await this.getter.agent.valueTransfer.getBalance()
    console.log(greenText(`\nCurrent balance: ${balance}`))
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.PaymentOfferTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.getter.abortPaymentOffer(valueTransferRecord)
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.getter.acceptPaymentOffer(valueTransferRecord)
    }
  }

  public async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.getter.exit()
    }
  }

  public async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
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
