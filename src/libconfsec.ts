import * as path from 'path';

// Interface for the native module
interface LibconfsecNative {
  confsecClientCreate(
    apiKey: string,
    concurrentRequestsTarget: number,
    maxCandidateNodes: number,
    defaultNodeTags: string[],
    env?: string | null
  ): number;
  confsecClientDestroy(handle: number): void;
  confsecClientGetDefaultCreditAmountPerRequest(handle: number): number;
  confsecClientGetMaxCandidateNodes(handle: number): number;
  confsecClientGetDefaultNodeTags(handle: number): string[];
  confsecClientSetDefaultNodeTags(
    handle: number,
    defaultNodeTags: string[]
  ): void;
  confsecClientGetWalletStatus(handle: number): string;
  confsecClientDoRequest(handle: number, request: string | Buffer): number;
  confsecResponseDestroy(handle: number): void;
  confsecResponseGetMetadata(handle: number): Buffer;
  confsecResponseIsStreaming(handle: number): boolean;
  confsecResponseGetBody(handle: number): Buffer;
  confsecResponseGetStream(handle: number): number;
  confsecResponseStreamGetNext(handle: number): Buffer | null;
  confsecResponseStreamDestroy(handle: number): void;
}

// Try to load the built native module
//eslint-disable-next-line @typescript-eslint/no-var-requires
const native: LibconfsecNative = require(
  path.join(__dirname, '../build/Release/confsec.node')
) as LibconfsecNative;

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
  private destroyed: boolean = false;

  private _metadata: ResponseMetadata | null = null;
  private _isStreaming: boolean | null = null;
  private _body: Buffer | null = null;

  constructor(handle: number) {
    this.handle = handle;
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
    const raw = native.confsecResponseGetMetadata(this.handle);
    return <ResponseMetadata>JSON.parse(raw.toString('utf8'));
  }

  private getIsStreaming(): boolean {
    return native.confsecResponseIsStreaming(this.handle);
  }

  private getBody(): Buffer {
    return native.confsecResponseGetBody(this.handle);
  }

  /**
   * Get a stream for reading chunked responses
   */
  getStream(): ConfsecResponseStream {
    const streamHandle = native.confsecResponseGetStream(this.handle);
    return new ConfsecResponseStream(streamHandle);
  }

  /**
   * Destroy the response and free resources
   */
  destroy(): void {
    if (!this.destroyed) {
      native.confsecResponseDestroy(this.handle);
      this.destroyed = true;
    }
  }
}

/**
 * CONFSEC response stream for chunked responses
 */
export class ConfsecResponseStream {
  private handle: number;
  private destroyed: boolean = false;

  constructor(handle: number) {
    this.handle = handle;
  }

  /**
   * Get the next chunk from the stream
   * @returns Buffer containing the chunk, or null if no more chunks
   */
  getNext(): Buffer | null {
    return native.confsecResponseStreamGetNext(this.handle);
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
      native.confsecResponseStreamDestroy(this.handle);
      this.destroyed = true;
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

  constructor(config: ConfsecClientConfig) {
    const {
      apiKey,
      concurrentRequestsTarget = 10,
      maxCandidateNodes = 5,
      defaultNodeTags = [],
      env = null,
    } = config;

    this.handle = native.confsecClientCreate(
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
    return native.confsecClientGetDefaultCreditAmountPerRequest(this.handle);
  }

  /**
   * Get the maximum number of candidate nodes
   */
  getMaxCandidateNodes(): number {
    return native.confsecClientGetMaxCandidateNodes(this.handle);
  }

  /**
   * Get the current default node tags
   */
  getDefaultNodeTags(): string[] {
    return native.confsecClientGetDefaultNodeTags(this.handle);
  }

  /**
   * Set new default node tags
   */
  setDefaultNodeTags(tags: string[]): void {
    native.confsecClientSetDefaultNodeTags(this.handle, tags);
  }

  /**
   * Get the current wallet status
   */
  getWalletStatus(): WalletStatus {
    const raw = native.confsecClientGetWalletStatus(this.handle);
    return <WalletStatus>JSON.parse(raw);
  }

  /**
   * Send an HTTP request through the CONFSEC network
   * @param request - Raw HTTP request string or buffer
   * @returns ConfsecResponse object
   */
  doRequest(request: string | Buffer): ConfsecResponse {
    const responseHandle = native.confsecClientDoRequest(this.handle, request);
    return new ConfsecResponse(responseHandle);
  }

  /**
   * Destroy the client and free resources
   */
  destroy(): void {
    if (!this.destroyed) {
      native.confsecClientDestroy(this.handle);
      this.destroyed = true;
    }
  }
}
