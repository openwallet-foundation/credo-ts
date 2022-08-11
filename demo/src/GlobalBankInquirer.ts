import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { GlobalBank } from './GlobalBank'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runWitness = async () => {
  clear()
  console.log(textSync('GlobalBank', { horizontalLayout: 'full' }))
  const witness = await GlobalBankInquirer.build()
  await witness.processAnswer()
}

enum PromptOptions {
  Exit = 'Exit',
  Restart = 'Restart',
}

export class GlobalBankInquirer extends BaseInquirer {
  public witness: GlobalBank
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(witness: GlobalBank) {
    super()
    this.witness = witness
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.witness.agent, this.witness.name)
  }

  public static async build(): Promise<GlobalBankInquirer> {
    const getter = await GlobalBank.build()
    return new GlobalBankInquirer(getter)
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
