import { OpenAI as _OpenAI } from 'openai';
import { Chat } from 'openai/resources/chat';
import { Completions } from 'openai/resources/completions';
import { ConfsecClient, ConfsecClientConfig } from './libconfsec/client';
import { Closeable } from './closeable';

const BASE_URL = 'https://confsec.invalid/v1';

type ConfsecConfig = Omit<ConfsecClientConfig, 'apiKey'>;

export interface ClientOptions {
  apiKey?: string;
  confsecConfig: ConfsecConfig;
}

export class OpenAI extends Closeable {
  private _confsecClient: ConfsecClient;
  private _openaiClient: _OpenAI;

  public chat: Chat;
  public completions: Completions;

  constructor({ apiKey, confsecConfig }: ClientOptions) {
    super();
    apiKey = apiKey || process.env.CONFSEC_API_KEY;
    if (!apiKey) {
      throw new Error('No API key provided');
    }
    this._confsecClient = new ConfsecClient({ apiKey, ...confsecConfig });
    this._openaiClient = new _OpenAI({
      apiKey,
      baseURL: BASE_URL,
      fetch: this.confsecClient.getConfsecFetch(),
    });

    this.chat = this._openaiClient.chat;
    this.completions = this._openaiClient.completions;
  }

  get confsecClient() {
    return this._confsecClient;
  }

  doClose() {
    this.confsecClient.close();
  }
}
