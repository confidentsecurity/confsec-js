import { ConfsecClient } from '../client';
import { MockLibconfsec } from './utils/mocks';

const API_URL = 'https://api.openpcc-example.com';

describe('ConfsecResponse', () => {
  let lc: MockLibconfsec;
  let client: ConfsecClient;

  beforeEach(() => {
    lc = new MockLibconfsec();
    client = new ConfsecClient({
      apiUrl: API_URL,
      apiKey: 'test',
      libconfsec: lc,
    });
  });

  afterEach(() => {
    lc.reset();
  });

  test('metadata parses JSON correctly', () => {
    const metadata = {
      status_code: 200,
      reason_phrase: 'OK',
      http_version: 'HTTP/1.1',
      url: 'https://example.com',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    };
    lc.confsecClientDoRequest.mockReturnValue(1);
    lc.confsecResponseGetMetadata.mockReturnValue(JSON.stringify(metadata));
    const response = client.doRequest('foo');
    expect(response.metadata).toEqual(metadata);
    expect(lc.confsecResponseGetMetadata).toHaveBeenCalledWith(response.handle);
  });

  test('metadata caching', () => {
    const metadata = {
      status_code: 200,
      reason_phrase: 'OK',
      http_version: 'HTTP/1.1',
      url: 'https://example.com',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    };
    lc.confsecClientDoRequest.mockReturnValue(1);
    lc.confsecResponseGetMetadata.mockReturnValue(JSON.stringify(metadata));
    const response = client.doRequest('foo');
    expect(response.metadata).toEqual(metadata);
    expect(response.metadata).toEqual(metadata);
    expect(lc.confsecResponseGetMetadata).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseGetMetadata).toHaveBeenCalledWith(response.handle);
  });

  test('isStreaming calls confsecResponseIsStreaming', () => {
    lc.confsecClientDoRequest.mockReturnValue(1);
    lc.confsecResponseIsStreaming.mockReturnValue(false);
    const response = client.doRequest('foo');
    expect(response.isStreaming).toBe(false);
    expect(lc.confsecResponseIsStreaming).toHaveBeenCalledWith(response.handle);
  });

  test('body caching', () => {
    lc.confsecClientDoRequest.mockReturnValue(1);
    lc.confsecResponseGetBody.mockReturnValue(Buffer.from('foo'));
    const response = client.doRequest('foo');
    expect(response.body).toEqual(Buffer.from('foo'));
    expect(response.body).toEqual(Buffer.from('foo'));
    expect(lc.confsecResponseGetBody).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseGetBody).toHaveBeenCalledWith(response.handle);
  });

  test('close calls confsecResponseDestroy', () => {
    lc.confsecClientDoRequest.mockReturnValue(1);
    const response = client.doRequest('foo');
    response.close();
    expect(lc.confsecResponseDestroy).toHaveBeenCalledWith(response.handle);
  });
});

describe('ConfsecResponseStream', () => {
  let lc: MockLibconfsec;
  let client: ConfsecClient;

  beforeEach(() => {
    lc = new MockLibconfsec();
    client = new ConfsecClient({
      apiUrl: API_URL,
      apiKey: 'test',
      libconfsec: lc,
    });
  });

  afterEach(() => {
    lc.reset();
  });

  test('stream iteration', () => {
    lc.confsecClientDoRequest.mockReturnValue(1);
    lc.confsecResponseGetStream.mockReturnValue(2);
    lc.confsecResponseStreamGetNext
      .mockReturnValueOnce(Buffer.from('foo,'))
      .mockReturnValueOnce(Buffer.from('bar,'))
      .mockReturnValueOnce(Buffer.from('baz'))
      .mockReturnValueOnce(null);
    const response = client.doRequest('foo');
    const stream = response.getStream();
    expect(Array.from(stream)).toEqual([
      Buffer.from('foo,'),
      Buffer.from('bar,'),
      Buffer.from('baz'),
    ]);
    expect(lc.confsecResponseGetStream).toHaveBeenCalledWith(response.handle);
    expect(lc.confsecResponseStreamGetNext).toHaveBeenCalledTimes(4);
    expect(lc.confsecResponseStreamGetNext).toHaveBeenCalledWith(stream.handle);
    expect(lc.confsecResponseStreamDestroy).toHaveBeenCalledWith(stream.handle);
    expect(lc.confsecResponseDestroy).toHaveBeenCalledWith(response.handle);
  });
});
