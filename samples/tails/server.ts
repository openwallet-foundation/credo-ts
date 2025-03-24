import { createHash } from 'crypto'
import fs from 'fs'
import { ConsoleLogger, LogLevel } from '@credo-ts/core'
import express from 'express'
import multer, { diskStorage } from 'multer'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001
const app = express()

const baseFilePath = './tails'
const indexFilePath = `./${baseFilePath}/index.json`

if (!fs.existsSync(baseFilePath)) {
  fs.mkdirSync(baseFilePath, { recursive: true })
}
const tailsIndex = (
  fs.existsSync(indexFilePath) ? JSON.parse(fs.readFileSync(indexFilePath, { encoding: 'utf-8' })) : {}
) as Record<string, string>

const logger = new ConsoleLogger(LogLevel.debug)

function fileHash(filePath: string, algorithm = 'sha256') {
  return new Promise<string>((resolve, reject) => {
    const shasum = createHash(algorithm)
    try {
      const s = fs.createReadStream(filePath)
      s.on('data', (data) => {
        shasum.update(data)
      })
      // making digest
      s.on('end', () => {
        const hash = shasum.digest('hex')
        return resolve(hash)
      })
    } catch (_error) {
      return reject('error in calculation')
    }
  })
}

const fileStorage = diskStorage({
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  filename: (_req: any, file: { originalname: string }, cb: (arg0: null, arg1: string) => void) => {
    cb(null, `${file.originalname}-${new Date().toISOString()}`)
  },
})

// Allow to create invitation, no other way to ask for invitation yet
app.get('/:tailsFileId', async (req, res) => {
  logger.debug('requested file')

  const tailsFileId = req.params.tailsFileId
  if (!tailsFileId) {
    res.status(409).end()
    return
  }

  const fileName = tailsIndex[tailsFileId]

  if (!fileName) {
    logger.debug(`no entry found for tailsFileId: ${tailsFileId}`)
    res.status(404).end()
    return
  }

  const path = `${baseFilePath}/${fileName}`
  try {
    logger.debug(`reading file: ${path}`)

    if (!fs.existsSync(path)) {
      logger.debug(`file not found: ${path}`)
      res.status(404).end()
      return
    }

    const file = fs.createReadStream(path)
    res.setHeader('Content-Disposition', `attachment: filename="${fileName}"`)
    file.pipe(res)
  } catch (_error) {
    logger.debug(`error reading file: ${path}`)
    res.status(500).end()
  }
})

app.put('/:tailsFileId', multer({ storage: fileStorage }).single('file'), async (req, res) => {
  logger.info(`tails file upload: ${req.params.tailsFileId}`)

  const file = req.file

  if (!file) {
    logger.info(`No file found: ${JSON.stringify(req.headers)}`)
    return res.status(400).send('No files were uploaded.')
  }

  const tailsFileId = req.params.tailsFileId
  if (!tailsFileId) {
    // Clean up temporary file
    fs.rmSync(file.path)
    return res.status(409).send('Missing tailsFileId')
  }

  const item = tailsIndex[tailsFileId]

  if (item) {
    logger.debug(`there is already an entry for: ${tailsFileId}`)
    res.status(409).end()
    return
  }

  const hash = await fileHash(file.path)
  const destinationPath = `${baseFilePath}/${hash}`

  if (fs.existsSync(destinationPath)) {
    logger.warn('tails file already exists')
  } else {
    fs.copyFileSync(file.path, destinationPath)
    fs.rmSync(file.path)
  }

  // Store filename in index
  tailsIndex[tailsFileId] = hash
  fs.writeFileSync(indexFilePath, JSON.stringify(tailsIndex))

  res.status(200).end()
})

const run = async () => {
  app.listen(port)
  logger.info(`server started at port ${port}`)
}

void run()
