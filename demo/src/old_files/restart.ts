import { Agent } from "@aries-framework/core";
import { clear } from "console";
import figlet from "figlet";
import inquirer from 'inquirer'

export const restart = async (agent: Agent) => {
    const answer = await inquirer
    .prompt([
      {
        type: 'list',
        prefix: '',
        name: 'options',
        message: 'Are you sure?:',
        choices: 
        ['yes',
        'no'],
        filter(val) {
            return val.toLowerCase();
        },
      },
    ])
    if (answer.options == "yes"){
        return true
    }
    return false
}