import { Lifecycle, scoped } from 'tsyringe'

import { DidResolverService } from '../../dids'
import { AriesFrameworkError } from "@aries-framework/core";
import { KeyResolverInterface } from "@value-transfer/value-transfer-lib";

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferIdentityResolverService implements KeyResolverInterface {
    private resolverService: DidResolverService

    public constructor(resolverService: DidResolverService) {
        this.resolverService = resolverService
    }

    public async resolveKey(id: string) {
        const result = await this.resolverService.resolve(id)
        if (!result.didDocument || !result.didDocument.verificationMethod.length) {
            throw new AriesFrameworkError(`Unable to resolve DIDDoc for ${id}`)
        }

        const key = result.didDocument.verificationMethod[0].publicKeyBase58
        if (!key) {
            throw new AriesFrameworkError(`Unable to resolve DIDDoc for ${id}`)
        }

        return key
    }
}
