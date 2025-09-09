import * as path from 'path';
import { Fetch } from 'openai/core';
import { ILibconfsec } from './types';
import { Closeable } from '../closeable';

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
export class ConfsecResponse extends Closeable {
  private handle: number;
  private libconfsec: ILibconfsec;

  private _metadata: ResponseMetadata | null = null;
  private _isStreaming: boolean | null = null;
  private _body: Buffer | null = null;

  constructor(libconfsec: ILibconfsec, handle: number) {
    super();
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

  protected doClose(): void {
    this.libconfsec.confsecResponseDestroy(this.handle);
  }
}

/**
 * CONFSEC response stream for chunked responses
 */
export class ConfsecResponseStream extends Closeable {
  private handle: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private resp: ConfsecResponse;
  private libconfsec: ILibconfsec;

  constructor(libconfsec: ILibconfsec, resp: ConfsecResponse, handle: number) {
    super();
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
   * Create a ReadableStream from this ConfsecResponseStream
   */
  toReadableStream(): ReadableStream<Uint8Array> {
    const iterator = this[Symbol.iterator]();

    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller;
      },

      pull(controller) {
        try {
          const result = iterator.next();

          if (result.done) {
            controller.close();
            return;
          }

          // Convert Buffer to Uint8Array
          controller.enqueue(new Uint8Array(result.value));
        } catch (error) {
          controller.error(error);
        }
      },

      cancel: () => {
        // Clean up when stream is cancelled
        this.close();
      },
    });
  }

  /**
   * Destroy the stream and free resources
   */
  protected doClose(): void {
    this.libconfsec.confsecResponseStreamDestroy(this.handle);
    this.resp.close();
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
export class ConfsecClient extends Closeable {
  private handle: number;
  private libconfsec: ILibconfsec;

  constructor(config: ConfsecClientConfig) {
    super();
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

  fetcher(): Fetch {
    const confsecFetch: Fetch = async (
      url: RequestInfo,
      init?: RequestInit
    ): Promise<Response> => {
      return new Promise(resolve => {
        let request: Request;
        if (typeof url === 'string') {
          request = new Request(url, init);
        } else {
          request = url;
        }

        const resp = request.arrayBuffer().then(requestBody => {
          const encoder = new TextEncoder();
          const requestComponents: Uint8Array[] = [];
          const requestLine = `${request.method} ${request.url} HTTP/1.1\r\n`;

          requestComponents.push(encoder.encode(requestLine));
          request.headers.forEach((value, name) => {
            requestComponents.push(encoder.encode(`${name}: ${value}\r\n`));
          });
          if (!request.headers.has('content-length')) {
            requestComponents.push(
              encoder.encode(`content-length: ${requestBody.byteLength}\r\n`)
            );
          }
          requestComponents.push(encoder.encode('\r\n'));
          requestComponents.push(
            requestBody ? new Uint8Array(requestBody) : new Uint8Array()
          );

          const rawRequest = Buffer.concat(requestComponents);
          const confsecResponse = this.doRequest(rawRequest);

          const responseBody = confsecResponse.isStreaming
            ? confsecResponse.getStream().toReadableStream()
            : new Uint8Array(confsecResponse.body);

          const responseHeaders = new Headers();
          confsecResponse.metadata.headers.forEach(header => {
            responseHeaders.append(header.key, header.value);
          });

          const resp = new Response(responseBody, {
            status: confsecResponse.metadata.status_code,
            statusText: confsecResponse.metadata.reason_phrase,
            headers: responseHeaders,
          });

          if (!confsecResponse.isStreaming) {
            confsecResponse.close();
          }

          return resp;
        });

        resolve(resp);
      });
    };
    return confsecFetch;
  }

  /**
   * Destroy the client and free resources
   */
  protected doClose(): void {
    this.libconfsec.confsecClientDestroy(this.handle);
  }
}
