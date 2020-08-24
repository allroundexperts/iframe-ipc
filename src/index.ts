import { nanoid } from 'nanoid';

/**
 * IPC library used to communicate with iframes
 * asynchronously. This is a wrapper around JS Message
 * Channels, allowing for a more simpler request/response
 * oriented communication.
 */

// Incoming message type (request or a response)
enum MessageType {
  REQUEST,
  RESPONSE,
}

// Each message has to be in a specific format
type Message = {
  id: string;
  type: MessageType;
  event: string;
  data: unknown;
};

// All outgoing requests are queued in a special format.
type QueuedElement = {
  id: string;
  reject: (reason: string) => void;
  resolve: (value: unknown) => void;
};

// This handler is used to provide a response to incoming requests.
type EventHandler = (message: Message) => Promise<unknown> | unknown;

// A small utility function to validate the received message.
const messageSchema: Record<string, (value: unknown) => boolean> = {
  id: (value: unknown) => typeof value === 'string',
  type: (value: unknown) => value === 1 || value === 0,
  data: (value: unknown) => !!value,
};

class IPC {
  private queue: QueuedElement[];

  private port: MessagePort;

  private eventHandler?: EventHandler;

  constructor(port: MessagePort, handler?: EventHandler) {
    this.queue = [];
    // If not set, then the IPC is only capable of making requests. It won't be able to
    // answer or send responses.
    this.eventHandler = handler;
    this.port = port;
    this.port.onmessage = this.handleIncomingMessage;
  }

  public request = async <T>(event: string, data?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = this.sendRequest(event, data);
      // Reject if no response is received in 2s.
      const timer = window.setTimeout(() => {
        reject(new Error('TimeoutError: Did not receive response'));
      }, 2000);
      // Push the promise to the queue.
      this.queue.push({
        id,
        resolve: (value) => {
          // If resolution is before the timeout, clear the timeout so that we don't get weird errors.
          window.clearTimeout(timer);
          resolve(value as T);
        },
        reject,
      });
    });
  };

  private handleIncomingMessage = (e: MessageEvent) => {
    // Validate the message format.
    const message = this.parseMessage<Message>(e.data);
    if (message) {
      // Incoming message could be a request from iframe or a response to the request
      // initiated by parent
      const isRequest = message.type === MessageType.REQUEST;
      const handler = isRequest ? this.handleIncomingRequest : this.handleIncomingResponse;
      handler(message);
    }
  };

  private handleIncomingResponse = (response: Message) => {
    // See if queue has the promise with the given id. If found, resolve it.
    const element = this.deQueue(response.id);
    if (element) {
      element.resolve(response.data);
    }
  };

  // Handle the incoming message request
  private handleIncomingRequest = async (message: Message) => {
    try {
      // Send the message to our event handler. If an appropriate event is found,
      // the function returns some sort of response.
      const data = await this.eventHandler?.(message);
      // Send the response back, making sure that the response id is same as the request id.
      this.sendResponse(message, data);
    } catch (e) {
      // Something went wrong in executing the eventHandler function. Post back &
      // let the requester know.
      this.sendResponse(message, `Error: ${e}`);
    }
  };

  // See if the id exists in the queue. If it does, remove it &
  // return it.
  private deQueue = (id: string): QueuedElement | false => {
    const itemIndex = this.queue.findIndex((item) => item.id === id);
    if (itemIndex < 0) {
      return false;
    }
    const item = this.queue[itemIndex];
    this.queue = [...this.queue.slice(0, itemIndex - 1), ...this.queue.slice(itemIndex + 1)];
    return item;
  };

  private sendResponse = <T>(request: Message, data: T): void => {
    this.port.postMessage(
      // Format the message.
      JSON.stringify({
        id: request.id,
        event: request.event,
        type: MessageType.RESPONSE,
        data,
      })
    );
  };

  private sendRequest = <T>(event: string, data: T): string => {
    const requestId = nanoid();
    // Format the message.
    this.port.postMessage(
      JSON.stringify({
        id: requestId,
        type: MessageType.REQUEST,
        event,
        data: data || {},
      })
    );
    return requestId;
  };

  // Parse the incoming message, making sure that it conforms
  // to the format defined.
  private parseMessage = <T>(message: string): T | false => {
    try {
      const parsedMessage = JSON.parse(message);
      const errors = Object.keys(messageSchema)
        .filter((key) => !messageSchema[key](parsedMessage[key]))
        .map((key) => new Error(`${key} is invalid.`));
      return errors.length ? false : parsedMessage;
    } catch (e) {
      // eslint-disable-next-line
      console.log(`Invalid message received: ${e}`);
      return false;
    }
  };
}

export default IPC;
