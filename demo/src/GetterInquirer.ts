import { clear } from 'console'
import { textSync } from 'figlet'
import inquirer from 'inquirer'

import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Getter } from './Getter'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runFaber = async () => {
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
    await this.getter.requestPayment()
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
      await runFaber()
    }
  }
}

void runFaber()
