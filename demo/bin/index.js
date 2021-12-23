#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@aries-framework/core");
const node_1 = require("@aries-framework/node");
const credentials_1 = require("@aries-framework/core/build/modules/credentials");
const createAgent = async (name, port) => {
    const config = {
        label: name,
        logger: new core_1.ConsoleLogger(core_1.LogLevel.error),
        walletConfig: {
            id: name,
            key: name
        },
        endpoints: [`http://localhost:${port}`],
        autoAcceptConnections: true
    };
    const agent = new core_1.Agent(config, node_1.agentDependencies);
    agent.registerInboundTransport(new node_1.HttpInboundTransport({ port: port }));
    agent.registerOutboundTransport(new core_1.HttpOutboundTransport());
    agent.events.on(core_1.BasicMessageEventTypes.BasicMessageStateChanged, (event) => {
        if (event.payload.basicMessageRecord.role === 'receiver') {
            console.log(`${name} received a message: ${event.payload.message.content}`);
        }
    });
    await agent.initialize();
    return agent;
};
const register = async (annelein, klm) => {
    const schema = await klm.ledger.registerSchema({
        name: 'Koninklijke Luchtvaart Maatschappij',
        version: '1.0.0',
        attributes: ['depature date', 'returning date', 'actually happening']
    });
    const credentialDefenition = await klm.ledger.registerCredentialDefinition({
        schema,
        tag: 'latest',
        supportRevocation: false,
    });
    return credentialDefenition;
};
const issue_credential = async (klm, credentialDefenition, connectionRecord) => {
    const credentialPreview = credentials_1.CredentialPreview.fromRecord({
        'departure date': '05/01/2022',
        'returning date': '01/02/2022',
        'actually happening': 'yes'
    });
    await klm.credentials.offerCredential(connectionRecord.id, {
        credentialDefinitionId: credentialDefenition.id,
        preview: credentialPreview,
    });
};
const accept_offer = async (annelein) => {
    annelein.events.on(core_1.CredentialEventTypes.CredentialStateChanged, async ({ payload }) => {
        await annelein.credentials.acceptOffer(payload.credentialRecord.id);
    });
};
const try_cli = async (test) => {
    const chalk = require('chalk');
    const clear = require('clear');
    const figlet = require('figlet');
    const path = require('path');
    const program = require('commander');
    clear();
    console.log(chalk.red(figlet.textSync('pizza-cli', { horizontalLayout: 'full' })));
    program
        .version('0.0.1')
        .description("An example CLI for ordering pizza's")
        .option('-p, --peppers', 'Add peppers')
        .option('-P, --pineapple', 'Add pineapple')
        .option('-b, --bbq', 'Add bbq sauce')
        .option('-c, --cheese <type>', 'Add the specified type of cheese [marble]')
        .option('-C, --no-cheese', 'You do not want any cheese')
        .parse(process.argv);
    return test;
};
const run = async () => {
    try_cli("test");
    return;
    const annelein = await createAgent('Annelein', 9000);
    const klm = await createAgent('KLM', 9001);
    const { invitation, connectionRecord } = await annelein.connections.createConnection();
    const connectionRecordKLM = await klm.connections.receiveInvitation(invitation);
    await annelein.basicMessages.sendMessage(connectionRecord.id, 'Hi KLM! I want to go to CapeTown so bad!');
    await klm.basicMessages.sendMessage(connectionRecordKLM.id, 'Hi Annelein! We will send you your ticket <3');
    //Issue a schema and credential for a credential offer -> klm is offering a valid ticket to Annelein
    //schema = what information does this ticket hold
    const credentialDefenition = await register(annelein, klm);
    //klm sends that credential offer
    issue_credential(klm, credentialDefenition, connectionRecordKLM);
    //annelein receives credential offer
    accept_offer(annelein);
    //annelein stores that credential?
    //annelein accepts credential offer
    //Review the status in both annelein and klm
    //create_credential_offer_klm(klm, connectionRecordklm.id)
    //accept_credential_offer_annelein(annelein, connectionRecord.id)
};
run();
//# sourceMappingURL=index.js.map