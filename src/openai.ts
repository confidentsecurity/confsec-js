import { OpenAI as _OpenAI } from 'openai';
import { Chat } from 'openai/resources/chat';
import { Completions } from 'openai/resources/completions';
import { ConfsecClient, ConfsecClientConfig } from './libconfsec/client';

const BASE_URL = 'https://confsec.invalid/v1';

type ConfsecConfig = Omit<ConfsecClientConfig, 'apiKey' | 'libconfsec'>;

export interface ClientOptions {
  apiKey: string;
  confsecConfig?: ConfsecConfig;
}

export class OpenAI {
  private _confsecClient: ConfsecClient;
  private openaiClient: _OpenAI;
  public chat: Chat;
  public completions: Completions;

  constructor({ apiKey, confsecConfig }: ClientOptions) {
    this._confsecClient = new ConfsecClient({ apiKey, ...confsecConfig });
    this.openaiClient = new _OpenAI({
      apiKey,
      baseURL: BASE_URL,
      fetch: this.confsecClient.fetcher(),
    });

    this.chat = this.openaiClient.chat;
    this.completions = this.openaiClient.completions;
  }

  get confsecClient() {
    return this._confsecClient;
  }

  close() {
    this.confsecClient.destroy();
  }
}
