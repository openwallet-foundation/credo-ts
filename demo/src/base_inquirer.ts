import inquirer from "inquirer";
import { Title } from "./output_class";

export class BaseInquirer {
    optionsInquirer: any
    inputInquirer: any

    constructor() {
        this.optionsInquirer = {
            type: 'list',
            prefix: '',
            name: 'options',
            message: '',
            choices: [],
            };

        this.inputInquirer = {
            type: 'input',
            prefix: '',
            name: 'input',
            message: '',
            };
    }

    inquireOptions(promptOptions: string[]) {
        const optionsInquirer = this.optionsInquirer
        optionsInquirer.message = Title.optionsTitle
        optionsInquirer.choices = promptOptions
        return optionsInquirer
    }

    inquireInput(title: string) {
        const inputInquirer = this.inputInquirer
        inputInquirer.message = title
        return inputInquirer
    }

    inquireConfirmation(title: string) {
        const optionsInquirer = this.optionsInquirer
        optionsInquirer.message = title
        optionsInquirer.choices = ['yes', 'no']
        return optionsInquirer
    }

    async inquireMessage() {
        const inputInquirer = this.inputInquirer
        inputInquirer.message = Title.messageTitle
        const message = await inquirer.prompt([inputInquirer])
        
        if (message.input[0] == 'q'){
            return null
        } else {
            return message.input
        }
    }
}