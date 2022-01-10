import inquirer from "inquirer";

enum Title {
    optionsTitle = 'Options:',
    invitationTitle = 'Paste the invitation url here:',
    messageTitle = 'Write your message here:\nPress q to exit'
}

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

    getOptionsInquirer(promptOptions: string[]) {
        const optionsInquirer = this.optionsInquirer
        optionsInquirer.message = Title.optionsTitle
        optionsInquirer.choice = promptOptions
        return 
    }

    getInputInquirerMessage() {
        const inputInquirer = this.inputInquirer
        inputInquirer.message = Title.messageTitle
    }

    getInputInquirerInvitation() {
        const inputInquirer = this.inputInquirer
        inputInquirer.message = Title.invitationTitle
    }

    async promptMessage() {
        const message = await inquirer.prompt([this.getInputInquirerMessage()])
        
        if (message.message[0] == 'q'){
            return ""
        } else {
            return message
        }
    }
}