import { InfluxDB, Point, WriteOptions } from '@influxdata/influxdb-client'

import os from 'os'

// You can generate an API token from the "API Tokens Tab" in the UI
const token = 'tWD-23UlFV859QuPlSaakgm3c2GPGtEFhzHmvWS5CwZi18PD4rCYrE_Vjk6ONnqMNrfxGoUlx5GHJQD5au76IQ=='
const org = 'dsr'
const bucket = 'dsr_test'

const machineName = os.hostname()


const client = new InfluxDB({url: 'http://localhost:8086', token: token})


const writeApi = client.getWriteApi(org, bucket)
writeApi.useDefaultTags({host: machineName})

writeApi
  .close()
  .then(() => {
    console.log('FINISHED')
  })
  .catch(e => {
    console.error(e)
    console.log('Finished ERROR')
  })

async function writeAndFlushPoint(point: Point) : Promise<void> {
  const writeOptions:Partial<WriteOptions> = {
    maxRetries:0,
    writeFailed: (error: any, lines: Array<string>, attempt: number, expires: number): Promise<void> | void => {
      console.log('Write to influxdb failed', { error, lines })
    }
  }
  const writeApi = client.getWriteApi(org, bucket, undefined, writeOptions)
  writeApi.useDefaultTags({ machineName: machineName })
  console.debug('Writing point', { point })
  writeApi.writePoint(point)

  try {
    await writeApi.close()
  } catch (e) {
    console.error('Error sending point', e)
  }
}

///Artificial simulation of gossip metric
///Gossip protocol started and shared info about a specific trId
export async function reportGossipStart(userId: string, trId: number): Promise<void> {
  const point = new Point("vtp-start")
    .stringField('userId', userId)
    .stringField('trId', trId.toString())
    .timestamp(new Date())

  await writeAndFlushPoint(point)
}


///Artificial simulation of gossip metric
///Gossip protocol completed sharing info for specific trId
///E.g, this trID has been received and processed by every witness in the netrowk
export async function reportGossipCompleted(userId: string, trId: number): Promise<void> {
  const point = new Point('vtp-end')
    .stringField('userId', userId)
    .stringField('trId', trId.toString())
    .timestamp(new Date())
  await writeAndFlushPoint(point)
}


export async function flushAndClose(): Promise<void> {
  // return writeApi.close()
}
