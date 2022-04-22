import { Lifecycle, scoped } from 'tsyringe'

import { Wallet } from "@aries-framework/core";
import { CryptoInterface } from "@value-transfer/value-transfer-lib";
import { Buffer, JsonEncoder } from "../../../utils";

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferCryptoService implements CryptoInterface {
    private wallet: Wallet

    public constructor(wallet: Wallet) {
        this.wallet = wallet
    }

    // @ts-ignore
    async sign(payload: Buffer, key: string): Promise<Buffer> {
        return this.wallet.sign(payload, key)
    }

    // @ts-ignore
    async verify(payload: Buffer, signature: Buffer, key: string): Promise<boolean> {
        return this.wallet.verify(key, payload, signature)
    }

    // @ts-ignore
    async pack(payload: Buffer, senderKey: string, recipientKeys: string[]): Promise<Buffer> {
        const encrypted = await this.wallet.pack(payload, recipientKeys, senderKey)
        return JsonEncoder.toBuffer(encrypted)
    }

    // @ts-ignore
    async unpack(payload: Buffer): Promise<Buffer> {
        const decrypted = await this.wallet.unpack(JsonEncoder.fromBuffer(payload))
        return JsonEncoder.toBuffer(decrypted.plaintextMessage)
    }
}
