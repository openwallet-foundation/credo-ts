import { Agent } from '@aries-framework/core';
import inquirer from 'inquirer'

export const annelein_inquirer = async (annelein: Agent) =>{
    const answer = await inquirer
    .prompt([
      {
        type: 'list',
        prefix: '',
        name: 'options',
        message: 'Options:',
        choices: 
        ['Setup connection',
        'Propose proof',
        'Send Message',
        'Exit',
        'Restart'],
        filter(val) {
            return val.toLowerCase();
        },
      },
    ])
    return answer
  }