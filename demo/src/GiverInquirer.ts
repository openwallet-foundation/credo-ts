import type { OutOfBandRecord } from '@aries-framework/core/src/modules/oob/repository'
import type { ValueTransferRecord } from '@aries-framework/core/src/modules/value-transfer'

import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Giver } from './Giver'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runFaber = async () => {
  clear()
  console.log(textSync('Giver', { horizontalLayout: 'full' }))
  const giver = await GiverInquirer.build()
  await giver.processAnswer()
}

enum PromptOptions {
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
    if (this.giver.connectionRecordWitnessId) return inquirer.prompt([this.inquireOptions(this.promptOptionsString)])

    const reducedOption = [PromptOptions.Exit, PromptOptions.Restart]
    return inquirer.prompt([this.inquireOptions(reducedOption)])
  }

  public async processAnswer() {
    this.listener.giverOutOfBandListener(this.giver, this)
    this.listener.paymentRequestListener(this.giver, this)

    const choice = await this.getPromptChoice()
    if (this.listener.on) return

    switch (choice.options) {
      case PromptOptions.Exit:
        await this.exit()
        break
      case PromptOptions.Restart:
        await this.restart()
        return
    }
    await this.processAnswer()
  }

  public async handleOutOBandInvitation(outOfBandRecord: OutOfBandRecord) {
    await this.giver.handleOutOBandInvitation(outOfBandRecord)
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.PaymentRequestTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
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
