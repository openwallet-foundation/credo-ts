import { InfluxDB, Point, WriteOptions } from '@influxdata/influxdb-client'
import type { GossipMetricsInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import os from 'os'

const influxDbConfig = {
  // You can generate an API token from the "API Tokens Tab" in the UI
  token: 'PsxPtqHVTPON1ln95oCLfxNBKwqcjFltLLM2KOWJ_pa0QH-rHkYFhmZReK0oNpWzIMbPk7xjnBS1MxUNYDIFHA==',
  org: 'dsr',
  bucket: 'dsr-test',
}

const machineName = os.hostname()

export class MetricsService implements GossipMetricsInterface {
  private client: InfluxDB = new InfluxDB({ url: 'http://localhost:8086', token: influxDbConfig.token })

  // Gossip protocol started to share transaction update
  public async reportGossipStart(witnessId: string, transactionUpdateId: string): Promise<void> {
    const point = new Point('gossip-start')
      .stringField('wid', witnessId)
      .tag('trId', transactionUpdateId)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  // Gossip protocol completed processing transaction update on specific Witness
  // This event should be emitted by every Witness in network after transaction update processing
  public async reportGossipCompleted(witnessId: string, transactionUpdateId: string): Promise<void> {
    const point = new Point('gossip-end')
      .stringField('wid', witnessId)
      .tag('trId', transactionUpdateId)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  public async reportTockTransactionsCount(witnessId: string, count: number): Promise<void> {
    const point = new Point('tock-transactions-count')
      .stringField('wid', witnessId)
      .intField('trCount', count)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  public async reportGossipMessageSize(witnessId: string, sizeInBytes: number): Promise<void> {
    const point = new Point('gossip-message-size')
      .stringField('wid', witnessId)
      .floatField('size', sizeInBytes)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  public async reportTransactionUpdateTime(witnessId: string, timeInMs: number): Promise<void> {
    const point = new Point('tu-processing-time')
      .stringField('wid', witnessId)
      .floatField('processTime', timeInMs)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  public async reportWitnessStateSize(witnessId: string, sizeInBytes: number): Promise<void> {
    const point = new Point('witness-state-size')
      .stringField('wid', witnessId)
      .floatField('size', sizeInBytes)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  private async writeAndFlushPoint(point: Point): Promise<void> {
    const gossipVersion = Math.random() < 0.5 ? '1.0' : '2.0'

    const writeOptions: Partial<WriteOptions> = {
      defaultTags: { machineName, gossipVersion },
      maxRetries: 0,
      writeFailed: (error: any, lines: Array<string>, attempt: number, expires: number): Promise<void> | void => {
        console.log('Write to influxdb failed', { error, lines })
      },
    }

    const { org, bucket } = influxDbConfig
    const writeApi = this.client.getWriteApi(org, bucket, undefined, writeOptions)
    console.debug('Writing point', { point })
    writeApi.writePoint(point)

    try {
      await writeApi.close()
    } catch (e) {
      console.error('Error sending point', e)
    }
  }
}
