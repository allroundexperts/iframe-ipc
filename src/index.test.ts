import IPC from './index';

const channel = new MessageChannel();

const ipcA = new IPC(channel.port1, () => new Promise((res) => setTimeout(() => res(), 2500)));
const ipcB = new IPC(channel.port2, (event) => `Received event: ${event.event}`);
const e = 'TestEvent';

describe('IPC message validation', () => {
  const consoleOutput: string[] = [];
  const mockedLogger = (message: string) => consoleOutput.push(message);
  const spy = jest.spyOn(global.console, 'log').mockImplementation(mockedLogger);

  afterAll(() => spy.mockRestore());

  it('Passes when correct message format is passed', () => {
    channel.port1.postMessage(
      JSON.stringify({
        event: 'test',
        type: 0,
        id: '2f443xddsela',
        data: 'abc',
      })
    );
    expect(consoleOutput.length).toBe(0);
  });

  it('Fails when incoming request is of invalid format', async () => {
    channel.port1.postMessage('Wrong format');
    expect(consoleOutput[0]).toMatch(/Invalid message received:/);
  });
});

describe('Async IPC functionality', () => {
  it('Requests for data and receives correct response', async () => {
    const data = await ipcA.request<string>(e);
    expect(data).toBe(`Received event: ${e}`);
  });

  it('Fails when request takes greater than 2000ms', async () => {
    await expect(ipcB.request<string>(e)).rejects.toThrow('TimeoutError: Did not receive response');
  });
});