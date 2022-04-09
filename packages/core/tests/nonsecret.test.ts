import { Subject } from "rxjs";
import { SubjectInboundTransport, SubjectMessage } from "../../../tests/transport/SubjectInboundTransport";
import { SubjectOutboundTransport } from "../../../tests/transport/SubjectOutboundTransport";
import { Agent } from "../src/agent/Agent";
import { ConnectionRecord } from "../src/modules/connections";
import { getBaseConfig } from "./helpers";

const aliceConfig = getBaseConfig('Agents Alice', {
    endpoints: ['rxjs:alice'],
  })

  describe('nonsecret', () => {
    let aliceAgent: Agent
    let aliceConnection: ConnectionRecord
  
    afterAll(async () => {
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })
  
    test('store non-secret record', async () => {  
      aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
      await aliceAgent.initialize()
      
      //Save NonSecret message (Minimal)
      const savedRecord1 = await aliceAgent.nonSecret.saveRecord("Some data saved")
  
      //Save NonSecret message with tag
      const tags = { myTag: 'foobar' }
      const savedRecord2 = await aliceAgent.nonSecret.saveRecord("Some data saved", tags)

      expect(savedRecord1).toBeDefined()
      expect(savedRecord2).toBeDefined()
    })

    test('get non-secret records', async () => {  
        
        //Create NonSecret message
        const savedRecords = await aliceAgent.nonSecret.getAll()
        console.log("ALL:", savedRecords)
        expect(savedRecords?.length > 0).toBe(true)
    })

    test('get non-secret specific record', async () => {  
        
        //Create NonSecret message
        const savedRecords = await aliceAgent.nonSecret.findAllByQuery({  myTag: 'foobar' })
        console.log("wohoo:", savedRecords)
        expect(savedRecords?.length == 1).toBe(true)
    })
  
  })