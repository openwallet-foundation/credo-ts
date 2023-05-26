import { BaseAlice } from '../BaseAlice'

export class Alice extends BaseAlice {
  public constructor(port: number, name: string) {
    super(port, name)
  }

  public static async build(): Promise<Alice> {
    const alice = new Alice(9000, 'alice')
    await alice.initializeAgent()
    return alice
  }

  public async ping() {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.connections.sendPing(connectionRecord.id, {})
  }
}
