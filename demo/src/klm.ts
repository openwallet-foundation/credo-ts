import { ConnectionInvitationMessage, ConnectionRecord, CredentialEventTypes, CredentialPreview, CredentialState, CredentialStateChangedEvent, JsonTransformer, ProofEventTypes, ProofState, ProofStateChangedEvent } from '@aries-framework/core';
import clear from 'clear';
import figlet from 'figlet';
import inquirer from 'inquirer'
import { Cred, CredDef, Schema } from 'indy-sdk-react-native';
import { BaseAgent } from './base_agent';
import { JsonEncoder } from '@aries-framework/core/src/utils/JsonEncoder';
import { Color, Output } from './output_class';
import { uuid } from '@aries-framework/core/build/utils/uuid';
import { runAnnelein } from './annelein_inquirer';
import { runKlm } from './klm_inquirer';

enum options {
  Connection = "setup connection",
  Credential = "offer credential",
  Message = "send message",
  Exit = "exit",
  Restart = "restart"
}
  
  export class KLM extends BaseAgent {
    connectionRecordId?: string
    credentialDefinition?: CredDef
  
    constructor(port: number, name: string) {
      super(port, name)
      // super.initializeAgent() // this is not awaited..
    }

    public static async build(): Promise<KLM> {
      const klm = new KLM(9001, 'klm')
      await klm.initializeAgent()
      return klm
    }

    private async getConnectionRecord() {
      if (!this.connectionRecordId) {
        throw Error(Output.missingConnectionRecord)
      }
      return await this.agent.connections.getById(this.connectionRecordId)
    }

    private async receiveConnectionRequest(invitation_url: string) {
      const http = 'http://localhost:9000?c_i='
      let invitationJson = invitation_url.replace(http, '')
  
      try {
        invitationJson = JsonEncoder.fromBase64(invitationJson)
      } catch(e){
        console.log(`${Color.green}\nIt looks like your invitation link is not correctly formatted?\n${Color.reset}`)
        //misschien moet dit naar de inquirer?
        return
      }

      const invitationMessage = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)
      return await this.agent.connections.receiveInvitation(invitationMessage)
    }
    
    private async waitForConnection(connectionRecord: any) {
      connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
      console.log(Output.connectionEstablished)
      return connectionRecord.id
    }

    async acceptConnection(invitation_url: string) {
      let connectionRecord = await this.receiveConnectionRequest(invitation_url)
      this.connectionRecordId = await this.waitForConnection(connectionRecord)
    }

    private async registerSchema(){
      const schema = await this.agent.ledger.registerSchema({
        name: 'koninklijke luchtvaart maatschappij' + uuid(),
        version: '1.0.6',
        attributes: ['departure date', 'returning date', 'actually happening']
      })
      return schema
    }

    private credentialIssuedListener(){
      this.agent.events.on(
        CredentialEventTypes.CredentialStateChanged,
        async ({ payload }: CredentialStateChangedEvent) => {
          if (payload.credentialRecord.state !== CredentialState.Done) {
            return
          }
          console.log("\x1b[32m\nCredential issued!\n\x1b[0m");
        }
      )
    }

    private async registerCredentialDefiniton(schema: Schema) {
      this.credentialDefinition = await this.agent.ledger.registerCredentialDefinition({
        schema,
        tag: 'latest',
        supportRevocation: false,
      })
      return this.credentialDefinition
    }

    private getCredentialPreview() {
      const credentialPreview = CredentialPreview.fromRecord({
        'departure date':  '05/01/2022',
        'returning date': '01/02/2022',
        'actually happening': 'yes'
      })
      return credentialPreview
    }

    async issueCredential(){ //clean this up
      this.credentialIssuedListener()
      const schema = await this.registerSchema()
      const credentialDefinition = await this.registerCredentialDefiniton(schema)
      console.log(schema.attrNames) //kijken of je de schema attribute names ook automatisch zo binnen kan krijgen
      const credentialPreview = this.getCredentialPreview()
      const connectionRecord = await this.getConnectionRecord()
      await this.agent.credentials.offerCredential(connectionRecord.id, {
        credentialDefinitionId: credentialDefinition.id, 
        preview: credentialPreview,
      })
      console.log("\x1b[32m\nCredential offer send!\n\x1b[0m")
    }

    async sendMessage (message: string) {
      const connectionRecord = await this.getConnectionRecord()
      await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
    }
  
    async exit() {
      console.log("Exiting")
      process.exit()
    }
  
    async restart() {
      await this.agent.shutdown()
      runKlm()
      //memory leak?
    }
  }