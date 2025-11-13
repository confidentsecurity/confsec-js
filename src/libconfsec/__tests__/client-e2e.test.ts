import { ConfsecClient } from '../client';
import { ConfsecResponse } from '../response';

type CompletionResponse = {
  choices: { text: string }[];
};

const API_URL = 'https://app.confident.security';
const URL = 'https://confsec.invalid/v1/completions';
const MODEL = 'gpt-oss:20b';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
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
      apiUrl: API_URL,
      apiKey,
      oidcIssuerRegex: 'https://token.actions.githubusercontent.com',
      oidcSubjectRegex:
        '^https://github.com/confidentsecurity/T/.github/workflows.*',
      concurrentRequestsTarget: 5,
      maxCandidateNodes: 3,
      defaultNodeTags: ['model=gpt-oss:20b'],
    });
  });

  afterAll(() => {
    client.close();
  });

  test('client configuration getters', () => {
    expect(client.getMaxCandidateNodes()).toBe(3);
    expect(client.getDefaultNodeTags()).toEqual(['model=gpt-oss:20b']);
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
    const body = JSON.parse(resp.body.toString('utf8')) as CompletionResponse;
    resp.close();
    expect(statusCode).toBe(200);
    expect(contentType).toContain('application/json');
    expect(body).toHaveProperty('choices');
    expect(body.choices.length).toBeGreaterThan(0);
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
    expect(contentType).toContain('text/event-stream');
    expect(isStreaming).toBe(true);
    let body = '';
    const chunks: string[] = [];
    for (const chunk of resp.getStream()) {
      body = body + chunk.toString('utf8');
      const lines = body.split('\n');
      if (lines.length <= 1) continue;
      for (let line of lines.slice(0, -1)) {
        line = line.trim().replace(/^data: /, '');
        if (line === '[DONE]' || line === '') break;
        const json = JSON.parse(line) as CompletionResponse;
        expect(json).toHaveProperty('choices');
        if (json.choices.length > 0) {
          chunks.push(json.choices[0].text);
        }
      }
      body = lines[lines.length - 1];
    }
    resp.close();
    expect(chunks.length).toBeGreaterThan(1);
    const fullResponse = chunks.join('');
    expect(fullResponse.length).toBeGreaterThan(0);
  });

  test('non-streaming request with confsecFetch', async () => {
    const confsecFetch = client.getConfsecFetch();
    const resp = await confsecFetch(URL, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: new Uint8Array(getBody(PROMPT)),
    });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('application/json');
    const body = (await resp.json()) as CompletionResponse;
    expect(body).toHaveProperty('choices');
    expect(body.choices.length).toBeGreaterThan(0);
  });

  test('streaming request with confsecFetch', async () => {
    const confsecFetch = client.getConfsecFetch();
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
      for (let line of lines.slice(0, -1)) {
        line = line.trim().replace(/^data: /, '');
        if (line === '[DONE]' || line === '') break;
        const json = JSON.parse(line) as CompletionResponse;
        expect(json).toHaveProperty('choices');
        if (json.choices.length > 0) {
          chunks.push(json.choices[0].text);
        }
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
      new ConfsecClient({ apiUrl: API_URL, apiKey: 'invalid' });
    }).toThrow('invalid API key');
  });

  test('should throw error when using destroyed client', () => {
    const client = new ConfsecClient({
      apiUrl: API_URL,
      apiKey,
      oidcIssuerRegex: 'https://token.actions.githubusercontent.com',
      oidcSubjectRegex:
        '^https://github.com/confidentsecurity/T/.github/workflows.*',
    });
    client.close();
    expect(() => {
      client.getMaxCandidateNodes();
    }).toThrow('client not found');
  });
});
