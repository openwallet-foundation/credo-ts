import { Agent } from '@aries-framework/core';
import inquirer from 'inquirer'
import { process_answer_klm } from './klm';

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
        'Print credential definition',
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