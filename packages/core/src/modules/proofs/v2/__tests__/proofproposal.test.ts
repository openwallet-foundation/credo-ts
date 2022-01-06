import { CredDefId } from "indy-sdk";
import { PredicateType, PresentationPreviewAttribute, PresentationPreviewPredicate } from "../..";
import { setupProofsTest, waitForProofRecord } from "../../../../../tests/helpers";
import testLogger from "../../../../../tests/logger";
import { Agent } from "../../../../agent/Agent";
import { ConnectionRecord } from "../../../connections";
import { PresentationPreview } from "../../PresentationPreview";
import { ProofProtocolVersion } from "../../ProofProtocolVersion";
import { ProposeProofOptions } from "../interface";


describe('Present Proof', () => {
    let faberAgent: Agent
    let aliceAgent: Agent
    let credDefId: CredDefId
    let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let presentationPreview: PresentationPreview
    
    beforeAll(async () => {
        testLogger.test('Initializing the agents')
      ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, presentationPreview } =
        await setupProofsTest('Faber agent', 'Alice agent'))
    })
  
    afterAll(async () => {
      testLogger.test('Shutting down both agents')
      await faberAgent.shutdown()
      await faberAgent.wallet.delete()
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    })
  
// ====================
// TEST V1 BEGIN 
// ====================

    test('Alice starts with V1 proof proposal to Faber', async () => {
        testLogger.test('Alice sends (v1) proof proposal to Faber')

        let attributes = [new PresentationPreviewAttribute({
            name: 'name',
            credentialDefinitionId: credDefId,
            value: 'John'
        })]

        let predicates = [new PresentationPreviewPredicate({
            name: 'age',
            predicate: PredicateType.GreaterThanOrEqualTo,
            threshold: 50,
            credentialDefinitionId: credDefId
        })]

        const proposeOptions: ProposeProofOptions = {
            connectionId: aliceConnection.id,
            protocolVersion: ProofProtocolVersion.V1_0,
            proofFormats: {
                indy:{
                    attributes,
                      predicates,
                }
            },
            comment: 'V1 propose proof test'
        }

        let presentationExchangeRecord = await aliceAgent.proofs.proposeProof(proposeOptions)

        expect(presentationExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)

        // let faberPresentationRecord = await waitForProofRecord(faberAgent, {
        //     threadId: presentationExchangeRecord
        // })

    })
}  