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
  private optionsInquirer: SelectQuestion = {
    type: 'select',
    theme: { prefix: '' },
    name: 'options',
    message: '',
    choices: [],
  }
  private inputInquirer: InputQuestion = {
    type: 'input',
    theme: { prefix: '' },
    name: 'input',
    message: '',
  }

  public async pickOne(options: string[], title?: string): Promise<string> {
    const result = await inquirer.prompt([
      {
        ...this.optionsInquirer,
        message: title ?? Title.OptionsTitle,
        choices: options,
      },
    ])

    return result.options
  }

  public async pickMultiple(options: string[], title?: string): Promise<string[]> {
    const result = await inquirer.prompt([
      {
        ...this.optionsInquirer,
        message: title ?? Title.OptionsTitle,
        choices: options,
        type: 'checkbox',
      },
    ])

    return result.options
  }

  public async inquireInput(title: string): Promise<string> {
    const result = await inquirer.prompt([
      {
        ...this.inputInquirer,
        message: title,
      },
    ])

    return result.input
  }

  public async inquireConfirmation(title: string) {
    const result = await inquirer.prompt([
      {
        ...this.optionsInquirer,
        choices: [ConfirmOptions.Yes, ConfirmOptions.No],
        message: title,
      },
    ])

    return result.options === ConfirmOptions.Yes
  }
}
