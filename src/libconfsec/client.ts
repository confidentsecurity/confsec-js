import * as path from 'path';
import { ILibconfsec } from './types';

function getLibConfsec(): ILibconfsec {
  //eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(
    path.join(__dirname, '../../build/Release/confsec.node')
  ) as ILibconfsec;
}

/**
 * Configuration options for creating a CONFSEC client
 */
export interface ConfsecClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Target number of concurrent requests (default: 10) */
  concurrentRequestsTarget?: number;
  /** Maximum number of candidate nodes to consider (default: 5) */
  maxCandidateNodes?: number;
  /** Default node tags to use for requests */
  defaultNodeTags?: string[];
  /** Environment to use */
  env?: string;
  /** Libconfsec implementation to use */
  libconfsec?: ILibconfsec;
}

export interface KV {
  key: string;
  value: string;
}

/**
 * Response metadata containing HTTP headers and status
 */
export interface ResponseMetadata {
  status_code: number;
  reason_phrase: string;
  http_version: string;
  url: string;
  headers: KV[];
}

/**
 * CONFSEC response object
 */
export class ConfsecResponse {
  private handle: number;
  private libconfsec: ILibconfsec;
  private destroyed: boolean = false;

  private _metadata: ResponseMetadata | null = null;
  private _isStreaming: boolean | null = null;
  private _body: Buffer | null = null;

  constructor(libconfsec: ILibconfsec, handle: number) {
    this.handle = handle;
    this.libconfsec = libconfsec;
  }

  /** Response metadata (headers, status, etc.) */
  get metadata(): ResponseMetadata {
    if (this._metadata === null) {
      this._metadata = this.getMetadata();
    }
    return this._metadata;
  }

  /** Whether the response is a streaming response */
  get isStreaming(): boolean {
    if (this._isStreaming === null) {
      this._isStreaming = this.getIsStreaming();
    }
    return this._isStreaming;
  }

  /** Response body (for non-streaming responses) */
  get body(): Buffer {
    if (this._body === null) {
      this._body = this.getBody();
    }
    return this._body;
  }

  private getMetadata(): ResponseMetadata {
    const raw = this.libconfsec.confsecResponseGetMetadata(this.handle);
    return <ResponseMetadata>JSON.parse(raw.toString('utf8'));
  }

  private getIsStreaming(): boolean {
    return this.libconfsec.confsecResponseIsStreaming(this.handle);
  }

  private getBody(): Buffer {
    return this.libconfsec.confsecResponseGetBody(this.handle);
  }

  /**
   * Get a stream for reading chunked responses
   */
  getStream(): ConfsecResponseStream {
    const streamHandle = this.libconfsec.confsecResponseGetStream(this.handle);
    return new ConfsecResponseStream(this.libconfsec, this, streamHandle);
  }

  /**
   * Destroy the response and free resources
   */
  destroy(): void {
    if (!this.destroyed) {
      this.libconfsec.confsecResponseDestroy(this.handle);
      this.destroyed = true;
    }
  }
}

/**
 * CONFSEC response stream for chunked responses
 */
export class ConfsecResponseStream {
  private handle: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private resp: ConfsecResponse;
  private libconfsec: ILibconfsec;
  private destroyed: boolean = false;

  constructor(libconfsec: ILibconfsec, resp: ConfsecResponse, handle: number) {
    this.handle = handle;
    this.resp = resp;
    this.libconfsec = libconfsec;
  }

  /**
   * Get the next chunk from the stream
   * @returns Buffer containing the chunk, or null if no more chunks
   */
  getNext(): Buffer | null {
    return this.libconfsec.confsecResponseStreamGetNext(this.handle);
  }

  [Symbol.iterator](): IterableIterator<Buffer> {
    return this;
  }

  next(): IteratorResult<Buffer> {
    const chunk = this.getNext();
    if (chunk === null) {
      return { done: true, value: undefined };
    }
    return { done: false, value: chunk };
  }

  /**
   * Destroy the stream and free resources
   */
  destroy(): void {
    if (!this.destroyed) {
      this.libconfsec.confsecResponseStreamDestroy(this.handle);
      this.destroyed = true;
      this.resp.destroy();
    }
  }
}

/**
 * Wallet status information
 */
export interface WalletStatus {
  credits_spent: number;
  credits_held: number;
  credits_available: number;
}

/**
 * CONFSEC client for making secure AI inference requests
 */
export class ConfsecClient {
  private handle: number;
  private destroyed: boolean = false;
  private libconfsec: ILibconfsec;

  constructor(config: ConfsecClientConfig) {
    const {
      apiKey,
      concurrentRequestsTarget = 10,
      maxCandidateNodes = 5,
      defaultNodeTags = [],
      env = null,
      libconfsec = null,
    } = config;

    this.libconfsec = libconfsec || getLibConfsec();

    this.handle = this.libconfsec.confsecClientCreate(
      apiKey,
      concurrentRequestsTarget,
      maxCandidateNodes,
      defaultNodeTags,
      env
    );
  }

  /**
   * Get the default credit amount per request
   */
  getDefaultCreditAmountPerRequest(): number {
    return this.libconfsec.confsecClientGetDefaultCreditAmountPerRequest(
      this.handle
    );
  }

  /**
   * Get the maximum number of candidate nodes
   */
  getMaxCandidateNodes(): number {
    return this.libconfsec.confsecClientGetMaxCandidateNodes(this.handle);
  }

  /**
   * Get the current default node tags
   */
  getDefaultNodeTags(): string[] {
    return this.libconfsec.confsecClientGetDefaultNodeTags(this.handle);
  }

  /**
   * Set new default node tags
   */
  setDefaultNodeTags(tags: string[]): void {
    this.libconfsec.confsecClientSetDefaultNodeTags(this.handle, tags);
  }

  /**
   * Get the current wallet status
   */
  getWalletStatus(): WalletStatus {
    const raw = this.libconfsec.confsecClientGetWalletStatus(this.handle);
    return <WalletStatus>JSON.parse(raw);
  }

  /**
   * Send an HTTP request through the CONFSEC network
   * @param request - Raw HTTP request string or buffer
   * @returns ConfsecResponse object
   */
  doRequest(request: string | Buffer): ConfsecResponse {
    const responseHandle = this.libconfsec.confsecClientDoRequest(
      this.handle,
      request
    );
    return new ConfsecResponse(this.libconfsec, responseHandle);
  }

  /**
   * Destroy the client and free resources
   */
  destroy(): void {
    if (!this.destroyed) {
      this.libconfsec.confsecClientDestroy(this.handle);
      this.destroyed = true;
    }
  }
}
