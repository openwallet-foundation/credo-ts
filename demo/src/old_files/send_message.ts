import { Agent } from '@aries-framework/core';
import inquirer from 'inquirer'

export const send_message = async (connectionRecordID: string, agent: Agent) => {
    const answer = await inquirer
    .prompt([
        {
        type: 'input',
        name: 'message',
        prefix: '',
        message: "Write your message here:\nPress q to exit",
        },
    ])
    if (answer.message[0] == 'q'){
        return 
    } else {
        await agent.basicMessages.sendMessage(connectionRecordID, answer.message)
    }
}