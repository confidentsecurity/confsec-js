import { OpenAI } from '../openai';

const MODEL = 'llama3.2:1b';

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
      confsecConfig: {
        defaultNodeTags: [`model=${MODEL}`],
      },
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

    let numEvents = 0;
    for await (const event of stream) {
      // Each event should have nonempty content
      expect(event.choices.length).toBeGreaterThan(0);
      if (event.choices[0].finish_reason == null) {
        expect(event.choices[0].text).toBeTruthy();
        numEvents++;
      }
    }
    // Should have received at least one event
    expect(numEvents).toBeGreaterThan(0);
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

    let numEvents = 0;
    for await (const event of stream) {
      // Each event should have nonempty content
      expect(event.choices.length).toBeGreaterThan(0);
      if (event.choices[0].finish_reason == null) {
        expect(event.choices[0].delta.content).toBeTruthy();
        numEvents++;
      }
    }
    // Should have received at least one event
    expect(numEvents).toBeGreaterThan(0);
  });
});
