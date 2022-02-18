import inquirer from 'inquirer'

import { Title } from './OutputClass'

export enum ConfirmOptions {
  Yes = 'yes',
  No = 'no',
}

export class BaseInquirer {
  public optionsInquirer: { type: string; prefix: string; name: string; message: string; choices: string[] }
  public inputInquirer: { type: string; prefix: string; name: string; message: string; choices: string[] }

  public constructor() {
    this.optionsInquirer = {
      type: 'list',
      prefix: '',
      name: 'options',
      message: '',
      choices: [],
    }

    this.inputInquirer = {
      type: 'input',
      prefix: '',
      name: 'input',
      message: '',
      choices: [],
    }
  }

  public inquireOptions(promptOptions: string[]) {
    const optionsInquirer = this.optionsInquirer
    optionsInquirer.message = Title.optionsTitle
    optionsInquirer.choices = promptOptions
    return optionsInquirer
  }

  public inquireInput(title: string) {
    const inputInquirer = this.inputInquirer
    inputInquirer.message = title
    return inputInquirer
  }

  public inquireConfirmation(title: string) {
    const optionsInquirer = this.optionsInquirer
    optionsInquirer.message = title
    optionsInquirer.choices = [ConfirmOptions.Yes, ConfirmOptions.No]
    return optionsInquirer
  }

  public async inquireMessage() {
    const inputInquirer = this.inputInquirer
    inputInquirer.message = Title.messageTitle
    const message = await inquirer.prompt([inputInquirer])

    if (message.input[0] == 'q') {
      return null
    } else {
      return message.input
    }
  }
}
