import { MockLibconfsec } from './utils/mocks';
import * as client from '../client';

const BASE_URL = 'https://confsec.invalid';

function url(path: string): string {
  return `${BASE_URL}${path}`;
}

describe('Request Preprocessing', () => {
  const encoder = new TextEncoder();

  test('preprocessRequest handles OpenAI paths', () => {
    const body = encoder.encode('{"model": "gpt-3.5-turbo"}').buffer;
    const paths = ['/v1/completions', '/v1/chat/completions'];
    paths.forEach(path => {
      const request = new Request(url(path));
      client.preProcessRequest(request, body);
      expect(request.headers.get('x-confsec-node-tags')).toEqual(
        'model=gpt-3.5-turbo'
      );
    });
  });

  test('preprocessRequest does not handle other paths', () => {
    const body = encoder.encode('{"model": "gpt-3.5-turbo"}').buffer;
    const paths = ['/api/generate', '/v1/chat'];
    paths.forEach(path => {
      const request = new Request(url(path));
      client.preProcessRequest(request, body);
      expect(request.headers.get('x-confsec-node-tags')).toBeNull();
    });
  });

  test('maybeAddModelTag with model in body', () => {
    const body = encoder.encode('{"model": "gpt-3.5-turbo"}').buffer;
    const request = new Request(url('/v1/completions'));
    client.maybeAddModelTag(request, body);
    expect(request.headers.get('x-confsec-node-tags')).toEqual(
      'model=gpt-3.5-turbo'
    );
  });

  test('maybeAddModelTag without model in body', () => {
    const body = encoder.encode('{"prompt": "Hello world"}').buffer;
    const request = new Request(url('/v1/completions'));
    client.maybeAddModelTag(request, body);
    expect(request.headers.get('x-confsec-node-tags')).toBeNull();
  });

  test('maybeAddModelTag with existing tags header without model tag', () => {
    const body = encoder.encode('{"model": "gpt-3.5-turbo"}').buffer;
    const request = new Request(url('/v1/completions'), {
      headers: { 'x-confsec-node-tags': 'foo=bar' },
    });
    client.maybeAddModelTag(request, body);
    expect(request.headers.get('x-confsec-node-tags')).toEqual(
      'foo=bar,model=gpt-3.5-turbo'
    );
  });

  test('maybeAddModelTag with existing tags header with model tag', () => {
    const body = encoder.encode('{"model": "gpt-3.5-turbo"}').buffer;
    const request = new Request(url('/v1/completions'), {
      headers: { 'x-confsec-node-tags': 'foo=bar,model=gpt-4' },
    });
    client.maybeAddModelTag(request, body);
    expect(request.headers.get('x-confsec-node-tags')).toEqual(
      'foo=bar,model=gpt-4'
    );
  });

  test('maybeAddModelTag with multiple tags', () => {
    const body = encoder.encode('{"model": "gpt-3.5-turbo"}').buffer;
    const request = new Request(url('/v1/completions'), {
      headers: { 'x-confsec-node-tags': 'foo=bar,baz=qux' },
    });
    client.maybeAddModelTag(request, body);
    expect(request.headers.get('x-confsec-node-tags')).toEqual(
      'foo=bar,baz=qux,model=gpt-3.5-turbo'
    );
  });

  test('maybeAddModelTag with null body', () => {
    const request = new Request(url('/v1/completions'));
    client.maybeAddModelTag(request, null);
    expect(request.headers.get('x-confsec-node-tags')).toBeNull();
  });

  test('maybeAddModelTag with non-JSON body', () => {
    const body = encoder.encode('this is not valid JSON').buffer;
    const request = new Request(url('/v1/completions'));
    client.maybeAddModelTag(request, body);
    expect(request.headers.get('x-confsec-node-tags')).toBeNull();
  });
});

describe('Request Encoding', () => {
  const encoder = new TextEncoder();

  test('prepareRequest basic encoding', () => {
    const body = encoder.encode('{"test": "data"}').buffer;
    const request = new Request(url('/v1/completions'), {
      headers: { 'content-type': 'application/json' },
    });
    const rawRequest = client.prepareRequest(request, body);

    const expected = Buffer.from(
      'GET /v1/completions HTTP/1.1\r\nhost: confsec.invalid\r\ncontent-type: application/json\r\ncontent-length: 16\r\n\r\n{"test": "data"}'
    );

    expect(rawRequest).toEqual(expected);
  });

  test('prepareRequest with multiple headers and empty body', () => {
    const request = new Request(url('/v1/completions'), {
      headers: {
        'content-type': 'application/json',
        'x-confsec-node-tags': 'foo=bar',
      },
    });

    const rawRequest = client.prepareRequest(request, null).toString('utf8');

    expect(rawRequest).toContain('GET /v1/completions HTTP/1.1\r\n');
    expect(rawRequest).toContain('host: confsec.invalid\r\n');
    expect(rawRequest).toContain('content-type: application/json\r\n');
    expect(rawRequest).toContain('x-confsec-node-tags: foo=bar\r\n');
    expect(rawRequest).toMatch(/\r\n\r\n$/);
  });
});

describe('CONFSEC fetch', () => {
  let lc: MockLibconfsec;
  let cc: client.ConfsecClient;

  beforeEach(() => {
    lc = new MockLibconfsec();
    cc = new client.ConfsecClient({
      apiKey: 'test',
      libconfsec: lc,
    });
  });

  afterEach(() => {
    lc.reset();
  });

  test('confsecFetch non-streaming response', async () => {
    lc.confsecResponseGetMetadata.mockReturnValue(
      Buffer.from(
        JSON.stringify({
          status_code: 200,
          reason_phrase: 'OK',
          http_version: 'HTTP/1.1',
          url: '',
          headers: [{ key: 'content-type', value: 'application/json' }],
        })
      )
    );
    lc.confsecResponseIsStreaming.mockReturnValue(false);
    lc.confsecResponseGetBody.mockReturnValue(Buffer.from('{"test": "data"}'));

    const confsecFetch = cc.getConfsecFetch();
    const response = await confsecFetch(url('/v1/completions'), {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
    });

    expect(response.status).toEqual(200);
    expect(response.headers.get('content-type')).toEqual('application/json');
    expect(await response.json()).toEqual({ test: 'data' });

    expect(lc.confsecClientDoRequest).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseGetMetadata).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseIsStreaming).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseGetBody).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseDestroy).toHaveBeenCalledTimes(1);
  });

  test('confsecFetch streaming response', async () => {
    lc.confsecResponseGetMetadata.mockReturnValue(
      Buffer.from(
        JSON.stringify({
          status_code: 200,
          reason_phrase: 'OK',
          http_version: 'HTTP/1.1',
          url: '',
          headers: [{ key: 'content-type', value: 'application/x-ndjson' }],
        })
      )
    );
    lc.confsecResponseIsStreaming.mockReturnValue(true);
    lc.confsecResponseGetStream.mockReturnValue(1);
    lc.confsecResponseStreamGetNext
      .mockReturnValueOnce(Buffer.from('{"test": "data"}'))
      .mockReturnValueOnce(null);

    const confsecFetch = cc.getConfsecFetch();
    const response = await confsecFetch(url('/v1/completions'), {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
    });

    expect(response.status).toEqual(200);
    expect(response.headers.get('content-type')).toEqual(
      'application/x-ndjson'
    );
    expect(await response.text()).toEqual('{"test": "data"}');

    expect(lc.confsecClientDoRequest).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseGetMetadata).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseIsStreaming).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseGetStream).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseStreamGetNext).toHaveBeenCalledTimes(2);
    expect(lc.confsecResponseStreamDestroy).toHaveBeenCalledTimes(1);
    expect(lc.confsecResponseDestroy).toHaveBeenCalledTimes(1);
  });
});
