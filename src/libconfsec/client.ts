import * as path from 'path';
import { Fetch } from 'openai/core';
import { ILibconfsec } from './types';
import { Closeable } from '../closeable';
import { ConfsecResponse } from './response';

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
  private _handle: number;
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

    this._handle = this.libconfsec.confsecClientCreate(
      apiKey,
      concurrentRequestsTarget,
      maxCandidateNodes,
      defaultNodeTags,
      env || 'prod'
    );
  }

  get handle(): number {
    return this._handle;
  }

  /**
   * Get the default credit amount per request
   */
  getDefaultCreditAmountPerRequest(): number {
    return this.libconfsec.confsecClientGetDefaultCreditAmountPerRequest(
      this._handle
    );
  }

  /**
   * Get the maximum number of candidate nodes
   */
  getMaxCandidateNodes(): number {
    return this.libconfsec.confsecClientGetMaxCandidateNodes(this._handle);
  }

  /**
   * Get the current default node tags
   */
  getDefaultNodeTags(): string[] {
    return this.libconfsec.confsecClientGetDefaultNodeTags(this._handle);
  }

  /**
   * Set new default node tags
   */
  setDefaultNodeTags(tags: string[]): void {
    this.libconfsec.confsecClientSetDefaultNodeTags(this._handle, tags);
  }

  /**
   * Get the current wallet status
   */
  getWalletStatus(): WalletStatus {
    const raw = this.libconfsec.confsecClientGetWalletStatus(this._handle);
    return <WalletStatus>JSON.parse(raw);
  }

  /**
   * Send an HTTP request through the CONFSEC network
   * @param request - Raw HTTP request string or buffer
   * @returns ConfsecResponse object
   */
  doRequest(request: string | Buffer): ConfsecResponse {
    const responseHandle = this.libconfsec.confsecClientDoRequest(
      this._handle,
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
    this.libconfsec.confsecClientDestroy(this._handle);
  }
}
