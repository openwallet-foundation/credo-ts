import {DefaultMediationRecord, MediationRecord, MediationTags, MediationStorageProps, MediationRole, MediationState} from ".."
import type { Verkey } from 'indy-sdk'
import { assert } from "console"

describe('MediationRecord test',() => {
    it('validates mediation record class',() => {
        const record = new MediationRecord({
            state:MediationState.Init,
            role:MediationRole.Recipient,
            connectionId:"fakeConnectionId",
            recipientKeys:["fakeRecipientKey"],
            tags: {
              state:MediationState.Init,
              role:MediationRole.Recipient,
              connectionId:"fakeConnectionId",
            },
          })
        assert(record.state, 'Expected MediationRecord to have an `state` property')
        expect(record.state).toBeDefined()
        assert(record.role, 'Expected MediationRecord to have an `role` property')
        expect(record.role).toBeDefined()
        assert(record.tags, 'Expected MediationRecord to have an `tags` property')
        assert(record.tags.state, 'Expected MediationRecord to have an `tags.state` property')
        assert(record.tags.role, 'Expected MediationRecord to have an `tags.role` property')
        assert(record.tags.connectionId, 'Expected MediationRecord to have an `tags.connectionId` property')
        assert(record.connectionId, 'Expected MediationRecord to have an `connectionId` property')
        expect(record.connectionId).toBeDefined()
        assert(record.endpoint, 'Expected MediationRecord to have an `endpoint` property')
        expect(record.endpoint).toBeDefined()
        assert(record.recipientKeys, 'Expected MediationRecord to have an `recipientKeys` property')
        expect(record.recipientKeys).toBeDefined()
        assert(record.routingKeys, 'Expected MediationRecord to have an `routingKeys` property')
        expect(record.routingKeys).toBeDefined()
    })
})