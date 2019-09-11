#!/usr/bin/env node
const express = require('express')
const SSE = require('express-sse')
const { queuesFromRedis } = require('.')
const redis = require('./lib/redis')

main()

async function main () {
  const redisOptions = { host: '127.0.0.1', port: 6379, db: '0' }
  const app = express()
  const sse = new SSE()

  app.get('/', express.static('client'))
  app.get('/stream', sse.init)
  app.listen(process.env.HTTP_PORT || process.env.PORT || 4000)

  const client = redis.getClient(redisOptions)
  const queues = await queuesFromRedis(client)
  setInterval(async () => {
    console.clear()
    const data = []
    for (const queue of queues) {
      const { active, completed, failed, waiting, delayed } = await status(queue)
      console.log(`-- ${queue.name.padEnd(20)} \tactive: ${active.length}\tcompleted: ${completed.length}\tfailed: ${failed.length}\twaiting: ${waiting.length}\tdelayed: ${delayed.length}`)
      data.push({ name: queue.name, active, completed, failed, waiting, delayed })
    }
    sse.send(data)
  }, 500)
}

async function status (queue) {
  const [
    active, completed, failed, waiting, delayed
  ] = await Promise.all([
    await queue.getActive(),
    await queue.getCompleted(),
    await queue.getFailed(),
    await queue.getWaiting(),
    await queue.getDelayed()
  ])

  return {
    active,
    completed,
    failed,
    waiting,
    delayed
  }
}