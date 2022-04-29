import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Listener } from './Listener'
import { Title } from './OutputClass'
import { Witness } from './Witness'

export const runFaber = async () => {
  clear()
  console.log(textSync('Witness', { horizontalLayout: 'full' }))
  const witness = await WitnessInquirer.build()
  await witness.processAnswer()
}

enum PromptOptions {
  ReceiveGetterConnectionUrl = 'Receive Getter connection invitation',
  ReceiveGiverConnectionUrl = 'Receive Giver connection invitation',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class WitnessInquirer extends BaseInquirer {
  public witness: Witness
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(witness: Witness) {
    super()
    this.witness = witness
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.witness.agent, this.witness.name)
  }

  public static async build(): Promise<WitnessInquirer> {
    const getter = await Witness.build()
    return new WitnessInquirer(getter)
  }

  private async getPromptChoice() {
    if (this.witness.connectionRecordGiverId && this.witness.connectionRecordGetterId)
      return inquirer.prompt([this.inquireOptions(this.promptOptionsString)])

    const reducedOption = [
      PromptOptions.ReceiveGetterConnectionUrl,
      PromptOptions.ReceiveGiverConnectionUrl,
      PromptOptions.Exit,
      PromptOptions.Restart,
    ]
    return inquirer.prompt([this.inquireOptions(reducedOption)])
  }

  public async processAnswer() {
    const choice = await this.getPromptChoice()
    if (this.listener.on) return

    switch (choice.options) {
      case PromptOptions.ReceiveGetterConnectionUrl:
        await this.getterConnection()
        break
      case PromptOptions.ReceiveGiverConnectionUrl:
        await this.giverConnection()
        break
      case PromptOptions.Exit:
        await this.exit()
        break
      case PromptOptions.Restart:
        await this.restart()
        return
    }
    await this.processAnswer()
  }

  public async getterConnection() {
    const title = Title.InvitationTitle
    const invitation = await inquirer.prompt([this.inquireInput(title)])
    await this.witness.acceptGetterConnection(invitation.input)
  }

  public async giverConnection() {
    const title = Title.InvitationTitle
    const invitation = await inquirer.prompt([this.inquireInput(title)])
    await this.witness.acceptGiverConnection(invitation.input)
  }

  public async exit() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.witness.exit()
    }
  }

  public async restart() {
    const confirm = await inquirer.prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.witness.restart()
      await runFaber()
    }
  }
}

void runFaber()
