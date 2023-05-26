import { BaseFaber } from '../BaseFaber'

export class Faber extends BaseFaber {
  public constructor(port: number, name: string) {
    super(port, name)
  }

  public static async build(): Promise<Faber> {
    const faber = new Faber(9001, 'faber')
    await faber.initializeAgent()
    return faber
  }

  public async setupConnection() {
    await this.printConnectionInvite('v2')
  }
}
