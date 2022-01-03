import { Agent } from '@aries-framework/core'
import { uuid } from '@aries-framework/core/build/utils/uuid'  
import { CredDef } from 'indy-sdk-react-native'

export const register_credential_schema = async (klm: Agent) : Promise<CredDef> => {
    const schema = await klm.ledger.registerSchema({
        name: 'koninklijke luchtvaart maatschappij' + uuid(),
        version: '1.0.6',
        attributes: ['departure date', 'returning date', 'actually happening']
    })

    const credentialDefenition = await klm.ledger.registerCredentialDefinition({
        schema,
        tag: 'latest',
        supportRevocation: false,
    })
    return credentialDefenition
}