import { clear } from 'console'
import { textSync } from 'figlet'
import { prompt } from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { CentralBankIssuer } from './CentralBankIssuer'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runWitness = async () => {
  clear()
  console.log(textSync('CentralBankIssuer', { horizontalLayout: 'full' }))
  const witness = await CentralBankIssuerInquirer.build()
  await witness.processAnswer()
}

enum PromptOptions {
  Exit = 'Exit',
  Restart = 'Restart',
}

export class CentralBankIssuerInquirer extends BaseInquirer {
  public centralBankIssuer: CentralBankIssuer
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(centralBankIssuer: CentralBankIssuer) {
    super()
    this.centralBankIssuer = centralBankIssuer
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.centralBankIssuer.agent, this.centralBankIssuer.name)
    this.listener.mintRequestListener(this.centralBankIssuer)
  }

  public static async build(): Promise<CentralBankIssuerInquirer> {
    const centralBankIssuer = await CentralBankIssuer.build()
    return new CentralBankIssuerInquirer(centralBankIssuer)
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
      await this.centralBankIssuer.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.centralBankIssuer.restart()
      await runWitness()
    }
  }
}

void runWitness()
