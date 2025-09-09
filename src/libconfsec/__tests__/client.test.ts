import { ConfsecClient, ConfsecResponse } from '../client';

const URL = 'https://confsec.invalid/api/generate';
const MODEL = 'llama3.2:1b';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/x-ndjson',
  'X-Confsec-Node-Tags': `model=${MODEL}`,
};
const PROMPT = 'Count to ten in Spanish';

function getApiKey() {
  const apiKey = process.env.CONFSEC_API_KEY;
  if (!apiKey) {
    throw new Error('CONFSEC_API_KEY not set');
  }
  return apiKey;
}

function request(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Buffer
): Buffer {
  if (body.length > 0 && headers['Content-Length'] === undefined) {
    headers['Content-Length'] = body.length.toString();
  }

  const requestLine = `${method} ${url} HTTP/1.1`;
  const headerLines = Object.entries(headers).map(
    ([key, value]) => `${key}: ${value}`
  );

  const request = [requestLine, ...headerLines, '', body.toString()].join(
    '\r\n'
  );
  return Buffer.from(request);
}

function getBody(prompt: string, stream: boolean = false): Buffer {
  return Buffer.from(
    JSON.stringify({
      model: MODEL,
      stream,
      prompt,
    })
  );
}

function getContentType(response: ConfsecResponse): string | undefined {
  return response.metadata.headers.find(h => h.key === 'Content-Type')?.value;
}

describe('Native Bindings Success Cases', () => {
  let client: ConfsecClient;

  beforeAll(() => {
    const apiKey = getApiKey();
    client = new ConfsecClient({
      apiKey,
      concurrentRequestsTarget: 5,
      maxCandidateNodes: 3,
      defaultNodeTags: ['model=llama3.2:1b'],
    });
  });

  afterAll(() => {
    client.destroy();
  });

  test('client configuration getters', () => {
    expect(client.getMaxCandidateNodes()).toBe(3);
    expect(client.getDefaultNodeTags()).toEqual(['model=llama3.2:1b']);
    expect(client.getDefaultCreditAmountPerRequest()).toBeGreaterThan(1);
  });

  test('wallet status retrieval', () => {
    const walletStatus = client.getWalletStatus();
    expect(walletStatus.credits_spent).toBe(0);
  });

  test.skip('update default node tags', () => {
    client.setDefaultNodeTags(['model=deepseek-r1:1.5b']);
    expect(client.getDefaultNodeTags()).toEqual(['model=deepseek-r1:1.5b']);
  });

  test('non-streaming request', () => {
    const req = request('POST', URL, { ...DEFAULT_HEADERS }, getBody(PROMPT));
    const resp = client.doRequest(req);
    const statusCode = resp.metadata.status_code;
    const contentType = getContentType(resp);
    const body = JSON.parse(resp.body.toString('utf8')) as {
      response: string;
    };
    resp.destroy();
    expect(statusCode).toBe(200);
    expect(contentType).toContain('application/json');
    expect(body).toHaveProperty('response');
    expect(body.response.length).toBeGreaterThan(0);
  });

  test('streaming request', () => {
    const req = request(
      'POST',
      URL,
      { ...DEFAULT_HEADERS },
      getBody(PROMPT, true)
    );
    const resp = client.doRequest(req);
    const statusCode = resp.metadata.status_code;
    const contentType = getContentType(resp);
    const isStreaming = resp.isStreaming;
    expect(statusCode).toBe(200);
    expect(contentType).toContain('application/x-ndjson');
    expect(isStreaming).toBe(true);
    let body = '';
    const chunks: string[] = [];
    for (const chunk of resp.getStream()) {
      body = body + chunk.toString('utf8');
      const lines = body.split('\n');
      if (lines.length <= 1) continue;
      for (const line of lines.slice(0, -1)) {
        const json = JSON.parse(line) as { response: string };
        expect(json).toHaveProperty('response');
        chunks.push(json.response);
      }
      body = lines[lines.length - 1];
    }
    resp.destroy();
    expect(chunks.length).toBeGreaterThan(1);
    const fullResponse = chunks.join('');
    expect(fullResponse.length).toBeGreaterThan(0);
  });

  test('non-streaming request with confsecFetch', async () => {
    const confsecFetch = client.fetcher();
    const resp = await confsecFetch(URL, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: new Uint8Array(getBody(PROMPT)),
    });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('application/json');
    const body = (await resp.json()) as { response: string };
    expect(body).toHaveProperty('response');
    expect(body.response.length).toBeGreaterThan(0);
  });

  test('streaming request with confsecFetch', async () => {
    const confsecFetch = client.fetcher();
    const resp = await confsecFetch(URL, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: new Uint8Array(getBody(PROMPT, true)),
    });
    expect(resp.status).toBe(200);
    const reader = resp.body?.getReader();
    const decoder = new TextDecoder();
    expect(reader).toBeDefined();
    let body = '';
    const chunks: string[] = [];
    const done = false;
    while (!done) {
      const { value, done } = await reader!.read();
      if (done) break;
      body = body + decoder.decode(value);
      const lines = body.split('\n');
      if (lines.length <= 1) continue;
      for (const line of lines.slice(0, -1)) {
        const json = JSON.parse(line) as { response: string };
        expect(json).toHaveProperty('response');
        chunks.push(json.response);
      }
      body = lines[lines.length - 1];
    }
    expect(chunks.length).toBeGreaterThan(1);
    const fullResponse = chunks.join('');
    expect(fullResponse.length).toBeGreaterThan(0);
  });
});

describe('Native Bindings Error Cases', () => {
  const apiKey = getApiKey();

  test('should throw error for invalid API key', () => {
    expect(() => {
      new ConfsecClient({ apiKey: 'invalid' });
    }).toThrow('invalid API key');
  });

  test('should throw error when using destroyed client', () => {
    const client = new ConfsecClient({ apiKey });
    client.destroy();
    expect(() => {
      client.getMaxCandidateNodes();
    }).toThrow('client not found');
  });
});
