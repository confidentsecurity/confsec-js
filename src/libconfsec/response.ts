import { ILibconfsec } from './types';
import { Closeable } from '../closeable';

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
  private _handle: number;
  private libconfsec: ILibconfsec;

  private _metadata: ResponseMetadata | null = null;
  private _isStreaming: boolean | null = null;
  private _body: Buffer | null = null;

  constructor(libconfsec: ILibconfsec, handle: number) {
    super();
    this._handle = handle;
    this.libconfsec = libconfsec;
  }

  get handle(): number {
    return this._handle;
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
    const raw = this.libconfsec.confsecResponseGetMetadata(this._handle);
    return <ResponseMetadata>JSON.parse(raw.toString('utf8'));
  }

  private getIsStreaming(): boolean {
    return this.libconfsec.confsecResponseIsStreaming(this._handle);
  }

  private getBody(): Buffer {
    return this.libconfsec.confsecResponseGetBody(this._handle);
  }

  /**
   * Get a stream for reading chunked responses
   */
  getStream(): ConfsecResponseStream {
    const streamHandle = this.libconfsec.confsecResponseGetStream(this._handle);
    return new ConfsecResponseStream(this.libconfsec, this, streamHandle);
  }

  protected doClose(): void {
    this.libconfsec.confsecResponseDestroy(this._handle);
  }
}

/**
 * CONFSEC response stream for chunked responses
 */
export class ConfsecResponseStream extends Closeable {
  private _handle: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private resp: ConfsecResponse;
  private libconfsec: ILibconfsec;

  constructor(libconfsec: ILibconfsec, resp: ConfsecResponse, handle: number) {
    super();
    this._handle = handle;
    this.resp = resp;
    this.libconfsec = libconfsec;
  }

  get handle(): number {
    return this._handle;
  }

  /**
   * Get the next chunk from the stream
   * @returns Buffer containing the chunk, or null if no more chunks
   */
  getNext(): Buffer | null {
    return this.libconfsec.confsecResponseStreamGetNext(this._handle);
  }

  [Symbol.iterator](): IterableIterator<Buffer> {
    return this;
  }

  next(): IteratorResult<Buffer> {
    const chunk = this.getNext();
    if (chunk === null) {
      this.close();
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
    this.libconfsec.confsecResponseStreamDestroy(this._handle);
    this.resp.close();
  }
}
