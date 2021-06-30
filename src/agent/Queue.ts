export class Queue<T> {
  private elements: T[] = []

  public get length() {
    return this.elements.length
  }

  public enqueue(element: T) {
    this.elements.push(element)
  }

  public dequeue() {
    return this.elements.shift()
  }

  public isEmpty() {
    return this.elements.length == 0
  }

  public peek() {
    return !this.isEmpty() ? this.elements[0] : undefined
  }

  public async waitForMessage(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.peek()) resolve(true)

      setInterval(() => {
        if (this.peek()) {
          resolve(true)
        }
      }, 0)
    })
  }
}
