import { InfluxDB, Point, WriteOptions } from '@influxdata/influxdb-client'
import { MetricsService as MetricsServiceInterface } from '@aries-framework/core'

import os from 'os'

// You can generate an API token from the "API Tokens Tab" in the UI
const token = '7j0n6J-XtyKy0LWvdzcGQfg4u2QYvGczyX2WtTPUP4axMfunoe3yLn3JSG7Bm6OxXHNiRhOK3jnuVmnUcLfyNQ=='
const org = 'dsr'
const bucket = 'dsr-test'

const gossipVersion = '1.0'

const machineName = os.hostname()

export class MetricsService implements MetricsServiceInterface {
  private client: InfluxDB = new InfluxDB({ url: 'http://localhost:8086', token: token })

  constructor() {
    const writeApi = this.client.getWriteApi(org, bucket)
    writeApi.useDefaultTags({ host: machineName })
    writeApi
      .close()
      .then(() => {
        console.log('FINISHED')
      })
      .catch((e) => {
        console.error(e)
        console.log('Finished ERROR')
      })
  }

  //Artificial simulation of gossip metric
  //Gossip protocol started and shared info about a specific trId
  async reportGossipStart(witnessId: string, transactionId: string): Promise<void> {
    const point = new Point('gossip-start')
      .stringField('wid', witnessId)
      .stringField('trId', transactionId)
      .stringField('gossipVersion', gossipVersion)
      .timestamp(new Date())

    await this.writeAndFlushPoint(point)
  }

  //Artificial simulation of gossip metric
  //Gossip protocol completed sharing info for specific trId
  //E.g, this trID has been received and processed by every witness in the network
  async reportGossipCompleted(witnessId: string, transactionId: string): Promise<void> {
    const point = new Point('gossip-end')
      .stringField('wid', witnessId)
      .stringField('trId', transactionId)
      .stringField('gossipVersion', gossipVersion)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  async reportTockTransactionsCount(witnessId: string, count: number): Promise<void> {
    const point = new Point('tock-transactions-count')
      .stringField('wid', witnessId)
      .intField('trCount', count)
      .stringField('gossipVersion', gossipVersion)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  async reportGossipMessageSize(witnessId: string, sizeInBytes: number): Promise<void> {
    const point = new Point('gossip-message-size')
      .stringField('wid', witnessId)
      .floatField('size', sizeInBytes)
      .stringField('gossipVersion', gossipVersion)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  async reportTransactionUpdateTime(witnessId: string, timeInMs: number): Promise<void> {
    const point = new Point('tu-processing-time')
      .stringField('wid', witnessId)
      .floatField('processTime', timeInMs)
      .stringField('gossipVersion', gossipVersion)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  async reportWitnessStateSize(witnessId: string, sizeInBytes: number): Promise<void> {
    const point = new Point('witness-state-size')
      .stringField('wid', witnessId)
      .floatField('size', sizeInBytes)
      .stringField('gossipVersion', gossipVersion)
      .timestamp(new Date())
    await this.writeAndFlushPoint(point)
  }

  private async writeAndFlushPoint(point: Point): Promise<void> {
    const writeOptions: Partial<WriteOptions> = {
      maxRetries: 0,
      writeFailed: (error: any, lines: Array<string>, attempt: number, expires: number): Promise<void> | void => {
        console.log('Write to influxdb failed', { error, lines })
      },
    }
    const writeApi = this.client.getWriteApi(org, bucket, undefined, writeOptions)
    writeApi.useDefaultTags({ machineName: machineName })
    console.debug('Writing point', { point })
    writeApi.writePoint(point)

    try {
      await writeApi.close()
    } catch (e) {
      console.error('Error sending point', e)
    }
  }
}
