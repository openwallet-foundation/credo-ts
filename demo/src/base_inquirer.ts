import inquirer from "inquirer";

enum Title {
    optionsTitle = 'Options:',
    invitationTitle = 'Paste the invitation url here:',
    messageTitle = 'Write your message here:\nPress q to exit',
    confirmTitle = 'Are you sure?:'
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
        return optionsInquirer
    }

    getInputInquirerMessage() {
        const inputInquirer = this.inputInquirer
        inputInquirer.message = Title.messageTitle
        return inputInquirer
    }

    getInputInquirerInvitation() {
        const inputInquirer = this.inputInquirer
        inputInquirer.message = Title.invitationTitle
        return inputInquirer
    }

    getOptionsInquirerConfirm() {
        const optionsInquirer = this.optionsInquirer
        optionsInquirer.message = Title.confirmTitle
        optionsInquirer.options = ['yes', 'no']
        return optionsInquirer
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