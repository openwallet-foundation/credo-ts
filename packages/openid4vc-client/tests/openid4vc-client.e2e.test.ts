import type { KeyDidCreateOptions } from '@aries-framework/core'

import { Agent, ConsoleLogger, KeyType, LogLevel, W3cCredentialRecord, W3cVcModule } from '@aries-framework/core'
import nock from 'nock'

import { didKeyToInstanceOfKey } from '../../core/src/modules/dids/helpers'
import { customDocumentLoader } from '../../core/src/modules/vc/__tests__/documentLoader'
import { getAgentOptions } from '../../core/tests/helpers'

import { OpenId4VcClientModule } from '@aries-framework/openid4vc-client'

import { aquireAccessTokenResponse, credentialRequestResponse, getMetadataResponse } from './fixtures'
import { TestLogger } from '../../core/tests/logger'


describe('OpenId4VcClient', () => {
    let agent: Agent<{
        openId4VcClient: OpenId4VcClientModule
        w3cVc: W3cVcModule
    }>

    beforeEach(async () => {
        const agentOptions = getAgentOptions(
            'OpenId4VcClient Agent',
            {
                logger: new TestLogger(LogLevel.test),
            },
            {
                openId4VcClient: new OpenId4VcClientModule(),
                w3cVc: new W3cVcModule({
                    documentLoader: customDocumentLoader,
                }),
            }
        )

        agent = new Agent(agentOptions)
        await agent.initialize()
    })

    afterEach(async () => {
        await agent.shutdown()
        await agent.wallet.delete()
    })

    describe('Pre-authorized flow', () => {
        const issuerUri =
            'openid-initiate-issuance://?issuer=https://launchpad.mattrlabs.com&credential_type=OpenBadgeCredential&pre-authorized_code=krBcsBIlye2T-G4-rHHnRZUCah9uzDKwohJK6ABNvL-'
        beforeAll(async () => {
            /**
             *  Below we're setting up some mock HTTP responses.
             *  These responses are based on the openid-initiate-issuance URI above
             * */

            // setup temporary redirect mock
            nock('https://launchpad.mattrlabs.com').get('/.well-known/openid-credential-issuer').reply(307, undefined, {
                Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
            })

            // setup server metadata response
            const httpMock = nock('https://launchpad.vii.electron.mattrlabs.io')
                .get('/.well-known/openid-credential-issuer')
                .reply(200, getMetadataResponse)

            // setup access token response
            httpMock.post('/oidc/v1/auth/token').reply(200, aquireAccessTokenResponse)

            // setup credential request response
            httpMock.post('/oidc/v1/auth/credential').reply(200, credentialRequestResponse)
        })

        afterAll(async () => {
            nock.cleanAll()
            nock.enableNetConnect()
        })

        it('Should successfully execute the pre-authorized flow', async () => {
            const did = await agent.dids.create<KeyDidCreateOptions>({
                method: 'key',
                options: {
                    keyType: KeyType.Ed25519,
                },
                secret: {
                    seed: '96213c3d7fc8d4d6754c7a0fd969598e',
                },
            })
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const keyInstance = didKeyToInstanceOfKey(did.didState.did!)

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const kid = `${did.didState.did!}#${keyInstance.fingerprint}`

            const w3cCredentialRecord = await agent.modules.openId4VcClient.preAuthorized({
                issuerUri,
                kid,
            }, false)

            expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

            expect(w3cCredentialRecord.credential.type).toEqual([
                'VerifiableCredential',
                'VerifiableCredentialExtension',
                'OpenBadgeCredential',
            ])

            // @ts-ignore
            expect(w3cCredentialRecord.credential.credentialSubject.id).toEqual(did.didState.did)
        })
    })

})
