import { ConnectionRecord } from '@aries-framework/core';
import { ProofStateChangedEvent } from '@aries-framework/core';
import { ProofState } from '@aries-framework/core';
import { ProofEventTypes } from '@aries-framework/core';
import { 
Agent,
InitConfig, 
ConsoleLogger, 
LogLevel, 
HttpOutboundTransport, 
BasicMessageEventTypes, 
BasicMessageStateChangedEvent, 
AutoAcceptCredential,
AutoAcceptProof} 
from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
// import { TestLogger } from '../../../packages/core/tests/logger'
// import { bc_coverin } from 'demo/src/index'
import clear from 'clear';
import figlet from 'figlet';
import { accept_connection } from './connection';
import { issue_credential } from './issue_credential';
import { klm_inquirer } from './klm_inquirer';
import { register_schema } from './register';
import { send_message } from './send_message'
import inquirer from 'inquirer'
import { CredDef } from 'indy-sdk-react-native';
import { exit } from 'process';
import { restart } from './restart';

const bc_coverin = `{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","blskey_pop":"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1","client_ip":"138.197.138.255","client_port":9702,"node_ip":"138.197.138.255","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","blskey_pop":"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5","client_ip":"138.197.138.255","client_port":9704,"node_ip":"138.197.138.255","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","blskey_pop":"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh","client_ip":"138.197.138.255","client_port":9706,"node_ip":"138.197.138.255","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","blskey_pop":"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP","client_ip":"138.197.138.255","client_port":9708,"node_ip":"138.197.138.255","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}`

enum options {
  Connection = "setup connection",
  Credential = "offer credential",
  CredDef = "print credential definition",
  Proof = "send proof request",
  Message = "send message",
  Exit = "exit",
  Restart = "restart"
}

let connectionRecord : ConnectionRecord | undefined
let credentialDefenition : CredDef | undefined
const ui = new inquirer.ui.BottomBar();

export const process_answer_klm = async (klm: Agent, answers: any) => {
  if (answers.options === options.Connection){
    connectionRecord = await accept_connection(klm)
  } else if (answers.options == options.Credential){
    ui.log.write('\x1b[36mRegistering a schema...\x1b[0m');
    credentialDefenition = await register_schema(klm)
    if (connectionRecord !== undefined && credentialDefenition !== undefined){
      await issue_credential(klm, credentialDefenition.id, connectionRecord)
    } else {
      ui.log.write("\x1b[31m Something went wrong.. Could it be that you have not set up a connection yet \x1b[0m")
    }
  } else if (answers.options == options.CredDef){
    console.log("creddef")
    if (credentialDefenition !== undefined){
      ui.log.write(`\x1b[36m ${credentialDefenition.id} \x1b[0m`)
    } else {
      ui.log.write("\x1b[31m Something went wrong.. Could it be that you have not set up a credential request? \x1b[0m")
    }
  } else if (answers.options == options.Message){
    if (connectionRecord !== undefined){
      await send_message(connectionRecord.id, klm)
    } else {
      ui.log.write("\x1b[31m Something went wrong.. Could it be that you have not set up a connection yet? \x1b[0m")
    }
  } else if (answers.options == options.Exit){
    process.exit()
  } else if (answers.options == options.Restart){
    const check = await restart(klm)
    if (check == true){
      klm.shutdown()
      run_klm()
      return
    }
  }
  const answer = await klm_inquirer(klm)
  process_answer_klm(klm, answer)
}

const accept_proof_proprosal = (klm: Agent) => {
  klm.events.on(ProofEventTypes.ProofStateChanged, (event: ProofStateChangedEvent) => {
    if (event.payload.proofRecord.state !== ProofState.ProposalReceived) {
      return
    }
    ui.log.write("\x1b[32mProof proposal accepted!\x1b[0m");
    klm.proofs.acceptProposal(event.payload.proofRecord.id)
  })
}

export const createAgentKLM = async (bc_coverin: string): Promise<Agent> => {

    const name = 'klm'
    const port = 9001

    const config: InitConfig = {
      label: name,
      //logger: new TestLogger(LogLevel.error),
      walletConfig: {
        id: name,
        key: name
      },
      publicDidSeed: "6b8b882e2618fa5d45ee7229ca880083",
      indyLedgers: [{
        genesisTransactions: bc_coverin,
        id: 'greenlights' + name,
        isProduction: false,
      }],
      endpoints: [`http://localhost:${port}`],
      autoAcceptConnections: true,
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      autoAcceptProofs: AutoAcceptProof.ContentApproved
    }
  
    const agent = new Agent(config, agentDependencies)
    agent.registerInboundTransport(new HttpInboundTransport({port: port}))
    agent.registerOutboundTransport(new HttpOutboundTransport())
  
    agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged, (event: BasicMessageStateChangedEvent) => {
      if (event.payload.basicMessageRecord.role === 'receiver') {
        ui.log.write(`\x1b[35m\n${name} received a message: ${event.payload.message.content}\n\x1b[0m`);
      }
    })
  
    await agent.initialize()
  
    return agent
  }


 const run_klm = async () => {
    clear();
    console.log(figlet.textSync('KLM', { horizontalLayout: 'full' }));
    const klm = await createAgentKLM(bc_coverin)
    console.log("\x1b[32m", 'Agent KLM created', "\x1b[0m")
    accept_proof_proprosal(klm)
    const answer = await klm_inquirer(klm)
    process_answer_klm(klm, answer)
  }

  run_klm()