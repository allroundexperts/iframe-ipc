import '@testing-library/jest-dom/extend-expect';

type PostMessageOptionsExtended = PostMessageOptions | Transferable[];

type MockedMessageEvent<T> = Event & {
  data: T;
  ports?: PostMessageOptionsExtended;
};

class MockedMessagePort {
  private open: boolean;

  private other?: MessagePort;

  private eventTarget: Window;

  private id1: string;

  private id2: string;

  constructor(id1: string, id2: string, other?: MessagePort) {
    this.open = false;
    this.other = other;
    this.id1 = id1;
    this.id2 = id2;
    // We could replace 'window' with 'new EventTarget when
    // JSDom supports that, or extend EventTarget.
    this.eventTarget = window;
  }

  setOther(port: MessagePort) {
    this.other = port;
  }

  addEventListener(message: string, handler: (e: Event) => void) {
    return this.eventTarget.addEventListener(message, handler);
  }

  removeEventListener() {
    return this;
  }

  dispatchEvent(event: Event) {
    return this.eventTarget.dispatchEvent(event);
  }

  get onmessage() {
    return () => this;
  }

  set onmessage(handler: (e: Event) => void) {
    this.eventTarget.addEventListener(`message:${this.id1}`, handler);
    this.open = true;
  }

  get onmessageerror() {
    return () => this;
  }

  set onmessageerror(handler: (e: Event) => void) {
    this.eventTarget.addEventListener(`error`, handler);
  }

  postMessage<T>(message: T, options?: PostMessageOptionsExtended) {
    if (this.other) {
      const event = new Event(`message:${this.id2}`) as MockedMessageEvent<T>;
      event.data = message;
      event.ports = options;
      this.other.dispatchEvent(event);
    }
  }

  start() {
    return this;
  }

  close() {
    return this;
  }
}

/**
 * A fake MessageChannel implementation.
 * When using a MessageChannel to communicate with a worker,
 * an event handler is hooked to port1 to get replies, and port2
 * is transferred to the worker, which then uses postMessage on it to
 * reply. So postMessage on port2 fires port1's event handler, and
 * vice versa.
 */

class MockedMessageChannel {
  public port1: MockedMessagePort;

  public port2: MockedMessagePort;

  constructor() {
    this.port1 = new MockedMessagePort('a', 'b');
    this.port2 = new MockedMessagePort('b', 'a', this.port1);
    this.port1.setOther(this.port2);
  }
}

Object.assign(global, {
  MessageChannel: MockedMessageChannel,
});
