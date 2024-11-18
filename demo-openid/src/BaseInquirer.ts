import { prompt } from 'inquirer'

import { Title } from './OutputClass'

export enum ConfirmOptions {
  Yes = 'yes',
  No = 'no',
}

export class BaseInquirer {
  private optionsInquirer = {
    type: 'list',
    prefix: '',
    name: 'options',
    message: '',
    choices: [],
  }
  private inputInquirer = {
    type: 'input',
    prefix: '',
    name: 'input',
    message: '',
    choices: [],
  }

  public async pickOne(options: string[], title?: string): Promise<string> {
    const result = await prompt([
      {
        ...this.optionsInquirer,
        message: title ?? Title.OptionsTitle,
        choices: options,
      },
    ])

    return result.options
  }

  public async pickMultiple(options: string[], title?: string): Promise<string[]> {
    const result = await prompt([
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
    const result = await prompt([
      {
        ...this.inputInquirer,
        message: title,
      },
    ])

    return result.input
  }

  public async inquireConfirmation(title: string) {
    const result = await prompt([
      {
        ...this.optionsInquirer,
        choices: [ConfirmOptions.Yes, ConfirmOptions.No],
        message: title,
      },
    ])

    return result.options === ConfirmOptions.Yes
  }
}
