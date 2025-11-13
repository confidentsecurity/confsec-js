import { OpenAI } from '../openai';

const MODEL = 'gpt-oss:20b';

const CONFSEC_CONFIG = {
  apiUrl: 'https://app.confident.security',
  oidcIssuerRegex: 'https://token.actions.githubusercontent.com',
  oidcSubjectRegex:
    '^https://github.com/confidentsecurity/T/.github/workflows.*',
  defaultNodeTags: [`model=${MODEL}`],
};

function getApiKey() {
  const apiKey = process.env.CONFSEC_API_KEY;
  if (!apiKey) {
    throw new Error('CONFSEC_API_KEY not set');
  }
  return apiKey;
}

describe('OpenAI wrapper e2e', () => {
  let openAI: OpenAI;

  beforeAll(() => {
    openAI = new OpenAI({
      apiKey: getApiKey(),
      confsecConfig: CONFSEC_CONFIG,
    });
  });

  afterAll(() => {
    openAI.close();
  });

  test('completions non-streaming', async () => {
    const response = await openAI.completions.create({
      model: MODEL,
      prompt: 'Count to three',
    });
    // Response should have nonempty content
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].text).toBeTruthy();
  });

  test('completions streaming', async () => {
    const stream = await openAI.completions.create({
      model: MODEL,
      prompt: 'Count to ten',
      stream: true,
    });

    const chunks: string[] = [];
    for await (const event of stream) {
      if (event.choices.length === 0) continue;
      if (event.choices[0].finish_reason == null) {
        chunks.push(event.choices[0].text);
      }
    }
    // Should have received a response in chunks
    expect(chunks.length).toBeGreaterThan(0);
  });

  test('chat non-streaming', async () => {
    const response = await openAI.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Count to three' }],
    });
    // Response should have nonempty content
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].message.content).toBeTruthy();
  });

  test('chat streaming', async () => {
    const stream = await openAI.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Count to ten' }],
      stream: true,
    });

    const chunks: string[] = [];
    for await (const event of stream) {
      if (event.choices.length === 0) continue;
      if (event.choices[0].finish_reason == null) {
        chunks.push(event.choices[0].delta.content);
      }
    }
    // Should have received a response in chunks
    expect(chunks.length).toBeGreaterThan(0);
  });
});
