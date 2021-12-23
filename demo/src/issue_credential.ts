import { 
Agent,
ConnectionRecord,
CredentialEventTypes,
CredentialState,
CredentialStateChangedEvent} from '@aries-framework/core'
import { CredentialPreview } from '@aries-framework/core/build/modules/credentials'
import indy from 'indy-sdk'
import inquirer from 'inquirer'

// @ts-ignore
// indy.setLogger(function (level, target, message, modulePath, file, line) {
//     console.log('libindy said:', level, target, message, modulePath, file, line)
// })

// @ts-ignore
indy.setRuntimeConfig ( {collect_backtrace: true} )

export const issue_credential = async (klm: Agent, credentialDefenitionId: string, connectionRecord: ConnectionRecord) => {
      klm.events.on(
        CredentialEventTypes.CredentialStateChanged,
        async ({ payload }: CredentialStateChangedEvent) => {
          if (payload.credentialRecord.state === CredentialState.Done) {
            const ui = new inquirer.ui.BottomBar();
            ui.log.write("\x1b[32m\nCredential issued!\n\x1b[0m");
            return
          }
        }
      )

    const credentialPreview = CredentialPreview.fromRecord({
      'departure date':  '05/01/2022',
      'returning date': '01/02/2022',
      'actually happening': 'yes'
    })
  
    await klm.credentials.offerCredential(connectionRecord.id, {
      credentialDefinitionId: credentialDefenitionId, 
      preview: credentialPreview,
    })
  }