function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16),
  )
}

function createArrayObserver(array, renderFunction) {
  return new Proxy(array, {
    set(target, property, value, receiver) {
      target[property] = value
      renderFunction()

      return true
    },
  })
}

class Observable {
  constructor() {
    this.observers = []
  }

  subscribe(f) {
    this.observers.push(f)
  }

  unsubscribe(f) {
    this.observers = this.observers.filter(subscriber => subscriber !== f)
  }

  notifyAll(data) {
    this.observers.forEach(observer => observer(data))
  }
}
