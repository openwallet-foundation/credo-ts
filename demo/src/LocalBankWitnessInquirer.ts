import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Listener } from './Listener'
import { LocalBankWitness } from './LocalBankWitness'
import { Title } from './OutputClass'

export const runWitness = async () => {
  clear()
  console.log(textSync('LocalBank', { horizontalLayout: 'full' }))
  const witness = await LocalBankWitnessInquirer.build()
  await witness.processAnswer()
}

enum PromptOptions {
  Exit = 'Exit',
  Restart = 'Restart',
}

export class LocalBankWitnessInquirer extends BaseInquirer {
  public witness: LocalBankWitness
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(witness: LocalBankWitness) {
    super()
    this.witness = witness
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.witness.agent, this.witness.name)
  }

  public static async build(): Promise<LocalBankWitnessInquirer> {
    const getter = await LocalBankWitness.build()
    return new LocalBankWitnessInquirer(getter)
  }

  private async getPromptChoice() {
    return prompt([this.inquireOptions(this.promptOptionsString)])
  }

  public async processAnswer() {
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

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.witness.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.witness.restart()
      await runWitness()
    }
  }
}

void runWitness()
