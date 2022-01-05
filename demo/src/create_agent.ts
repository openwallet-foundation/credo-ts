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
  
    await agent.initialize()

    agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged, (event: BasicMessageStateChangedEvent) => {
      if (event.payload.basicMessageRecord.role === 'receiver') {
        ui.log.write(`\x1b[35m\n${name} received a message: ${event.payload.message.content}\n\x1b[0m`);
      }
    })
    
    return agent
  }