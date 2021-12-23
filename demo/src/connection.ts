import { ConnectionInvitationMessage } from "@aries-framework/core"
import { ConnectionRecord } from "@aries-framework/core"
import { Agent } from "@aries-framework/core"
import inquirer from 'inquirer'
import { JsonTransformer } from "@aries-framework/core"
import { JsonEncoder } from "@aries-framework/core/src/utils/JsonEncoder"

export const connection = async (annelein: Agent) => {
    const {invitation, connectionRecord} = await annelein.connections.createConnection()
    console.log('\nYour invitation link:\n', invitation.toUrl({domain: 'http://localhost:9000'}), '\n')
    return connectionRecord
}


export const accept_connection = async (klm: Agent) => {
    const answer = await inquirer
    .prompt([
    {
        type: 'input',
        prefix: '',
        name: 'url',
        message: "Paste the invitation url here:",
    },
    ])
    let invitationJson = answer.url.replace('http://localhost:9000?c_i=', '')
    try {
        invitationJson = JsonEncoder.fromBase64(invitationJson)
    } catch (e){
        console.log("\x1b[31m", 'It looks like your invitation link is not correctly formatted?', "\x1b[0m")
        return
    }
    const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)
    let connectionRecordKLM = await klm.connections.receiveInvitation(invitation)
    connectionRecordKLM = await klm.connections.returnWhenIsConnected(connectionRecordKLM.id)
    console.log("\x1b[32m", "\nConnection established!\n", "\x1b[0m")
    return connectionRecordKLM
}