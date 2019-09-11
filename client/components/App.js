import * as preact from '/preact.js'
import Queue from '/components/Queue.js'
const { Component } = preact
const { eventSource } = window

export default class App extends Component {
  constructor () {
    super()
    this.state = {
      queues: [],
      showQueue: undefined,
      showQueueType: 'active'
    }
    eventSource.onmessage = (message) => {
      if (!message || !message.data) return console.error('skipping empty message')
      const queues = JSON.parse(message.data)
      queues.sort((q1, q2) => q1.name.localeCompare(q2.name))
      this.setState({ queues })
    }
  }

  render () {
    const self = this
    const layout = this.state.queues
      .map((queue) => preact.h(Queue, {
        queue,
        state: this.state,
        updateState: (state) => {
          self.setState(state)
        }
      }))
    return preact.h('div', null, layout)
  }
}