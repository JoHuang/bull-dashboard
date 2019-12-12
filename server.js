#!/usr/bin/env node
const express = require('express')
const SSE = require('express-sse')
const { queuesFromRedis } = require('.')
const redis = require('./lib/redis')
const namespace = process.argv[2]
const history = process.argv[3]
const delay = process.argv[4]
const { join, dirname } = require('path')
const { realpathSync } = require('fs')

if (require.main === module) {
  main({ namespace, history, delay })
} else {
  module.exports = main
}

async function main ({ namespace = 'bull', history = 100, delay = 100, port } = {}) {
  const app = express()
  const sse = new SSE()

  const staticDirPath = join(dirname(realpathSync(process.argv[1])), 'client')
  console.log({ staticDirPath })
  app.use('/', express.static(staticDirPath))
  app.get('/stream', sse.init)
  app.listen(port || process.env.HTTP_PORT || process.env.PORT || 4000)

  const redisOptions = { host: process.env.REDIS_HOST || '0.0.0.0', port: process.env.REDIS_PORT ? +process.env.REDIS_PORT : 6379, db: process.env.REDIS_DB || '0' }
  console.log({ redisOptions, namespace })
  const client = redis.getClient(redisOptions)
  let queues = await queuesFromRedis(client, namespace)
  setInterval(async () => {
    queues = await queuesFromRedis(client, namespace)
  }, 5000)

  while (true) {
    // console.clear()
    const data = []
    for (const queue of queues) {
      await Promise.all([
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getWaiting(),
        queue.getDelayed()
      ])
        .then(([active, completed, failed, waiting, delayed]) => {
          const activeLength = active.length
          active = slim(active, history)
          const completedLength = completed.length
          completed = slim(completed, history)
          const failedLength = failed.length
          failed = slim(failed, history)
          const waitingLength = waiting.length
          waiting = slim(waiting, history)
          const delayedLength = delayed.length
          delayed = slim(delayed, history)
          process.stdout.write(`-- ${queue.name.padEnd(20)} \tactive: ${activeLength}\tcompleted: ${completedLength}\tfailed: ${failedLength}\twaiting: ${waitingLength}\tdelayed: ${delayedLength}\n`)
          data.push({
            name: queue.name,
            active,
            activeLength,
            completed,
            completedLength,
            failed,
            failedLength,
            waiting,
            waitingLength,
            delayed,
            delayedLength
          })
        })
    }
    sse.send(data)
    data.length = 0

    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

function slim (data, history) {
  const keys = ['id', '_progress', 'finishedOn', 'processedOn', 'timestamp', 'data']
  return data.slice(0, history).map(d => {
    return keys.reduce((acc, key) => {
      if (!d) return acc
      acc[key] = d[key]
      return acc
    }, {})
  })
    .map(d => Object.assign(d, { progress: d._progress }))
}
