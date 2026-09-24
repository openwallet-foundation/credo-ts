import type { DistinctQuestion } from 'inquirer'
import inquirer from 'inquirer'

import { Title } from './OutputClass'

type SelectQuestion = Extract<DistinctQuestion, { type: 'select' }>
type InputQuestion = Extract<DistinctQuestion, { type: 'input' }>

export enum ConfirmOptions {
  Yes = 'yes',
  No = 'no',
}

export class BaseInquirer {
  public optionsInquirer: SelectQuestion
  public inputInquirer: InputQuestion

  public constructor() {
    this.optionsInquirer = {
      type: 'select',
      theme: { prefix: '' },
      name: 'options',
      message: '',
      choices: [],
    }

    this.inputInquirer = {
      type: 'input',
      theme: { prefix: '' },
      name: 'input',
      message: '',
    }
  }

  public inquireOptions(promptOptions: string[]): SelectQuestion {
    this.optionsInquirer.message = Title.OptionsTitle
    this.optionsInquirer.choices = promptOptions
    return this.optionsInquirer
  }

  public inquireInput(title: string): InputQuestion {
    this.inputInquirer.message = title
    return this.inputInquirer
  }

  public inquireConfirmation(title: string): SelectQuestion {
    this.optionsInquirer.message = title
    this.optionsInquirer.choices = [ConfirmOptions.Yes, ConfirmOptions.No]
    return this.optionsInquirer
  }

  public async inquireMessage() {
    this.inputInquirer.message = Title.MessageTitle
    const message = await inquirer.prompt([this.inputInquirer])

    return message.input[0] === 'q' ? null : message.input
  }
}
