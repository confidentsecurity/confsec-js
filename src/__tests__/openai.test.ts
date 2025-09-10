import * as client from '../libconfsec/client';
import { OpenAI } from '../openai';
import { MockLibconfsec } from '../libconfsec/__tests__/utils/mocks';

jest.mock('../libconfsec/client');

describe('OpenAI Initialization', () => {
  const lc = new MockLibconfsec();
  const MockConfsecClient = jest.mocked(client.ConfsecClient);

  afterEach(() => {
    delete process.env.CONFSEC_API_KEY;
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  test('init with explicit API key', () => {
    const apiKey = 'test';
    new OpenAI({
      apiKey,
      confsecConfig: { libconfsec: lc },
    });

    expect(MockConfsecClient).toHaveBeenCalledWith({
      apiKey,
      libconfsec: lc,
    });
  });

  test('init with env variable API key', () => {
    const apiKey = 'test';
    process.env.CONFSEC_API_KEY = apiKey;
    new OpenAI({
      confsecConfig: { libconfsec: lc },
    });

    expect(MockConfsecClient).toHaveBeenCalledWith({
      apiKey,
      libconfsec: lc,
    });
  });

  test('missing API key throws error', () => {
    expect(() => {
      new OpenAI({
        confsecConfig: { libconfsec: lc },
      });
    }).toThrow('No API key provided');
  });

  test('explicit API key takes precedence over env variable', () => {
    const apiKey = 'test';
    process.env.CONFSEC_API_KEY = 'other';
    new OpenAI({
      apiKey,
      confsecConfig: { libconfsec: lc },
    });

    expect(MockConfsecClient).toHaveBeenCalledWith({
      apiKey,
      libconfsec: lc,
    });
  });
});

describe('Resource Management', () => {
  const lc = new MockLibconfsec();
  const MockConfsecClient = jest.mocked(client.ConfsecClient);

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  test('OpenAI.close() closes the confsec client', () => {
    const openaiClient = new OpenAI({
      apiKey: 'test',
      confsecConfig: { libconfsec: lc },
    });
    openaiClient.close();
    //eslint-disable-next-line @typescript-eslint/unbound-method
    expect(MockConfsecClient.prototype.close).toHaveBeenCalledTimes(1);
  });
});
