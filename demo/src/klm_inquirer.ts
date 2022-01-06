import { Agent } from '@aries-framework/core';
import inquirer from 'inquirer'

export const klm_inquirer = async (klm: Agent) =>{
  const answer = await inquirer
    .prompt([
      {
        type: 'list',
        prefix: '',
        name: 'options',
        message: 'Options:',
        choices: 
        ['Setup connection',
        'Offer credential',
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