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
 * Client for making requests via CONFSEC.
 */
export class ConfsecClient extends Closeable {
  private _handle: number;
  private libconfsec: ILibconfsec;

  constructor({
    apiKey,
    concurrentRequestsTarget = 10,
    maxCandidateNodes = 5,
    defaultNodeTags = [],
    env = undefined,
    libconfsec = undefined,
  }: ConfsecClientConfig) {
    super();
    this.libconfsec = libconfsec || getLibConfsec();

    this._handle = this.libconfsec.confsecClientCreate(
      apiKey,
      concurrentRequestsTarget,
      maxCandidateNodes,
      defaultNodeTags,
      env || 'prod'
    );
  }

  /**
   * Get the underlying handle for this client
   */
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

  /**
   * Get a Fetch function that can be used to make requests through the CONFSEC network
   */
  getConfsecFetch(): Fetch {
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

        const response = request.arrayBuffer().then(requestBody => {
          preProcessRequest(request, requestBody);
          const rawRequest = prepareRequest(request, requestBody);
          const confsecResponse = this.doRequest(rawRequest);

          const responseBody = confsecResponse.isStreaming
            ? confsecResponse.getStream().toReadableStream()
            : new Uint8Array(confsecResponse.body);

          const responseHeaders = new Headers();
          confsecResponse.metadata.headers.forEach(header => {
            responseHeaders.append(header.key, header.value);
          });

          const httpResponse = new Response(responseBody, {
            status: confsecResponse.metadata.status_code,
            statusText: confsecResponse.metadata.reason_phrase,
            headers: responseHeaders,
          });

          if (!confsecResponse.isStreaming) {
            confsecResponse.close();
          }

          return httpResponse;
        });

        resolve(response);
      });
    };
    return confsecFetch;
  }

  /**
   * Close the client and free resources
   */
  protected doClose(): void {
    this.libconfsec.confsecClientDestroy(this._handle);
  }
}

const OPENAI_COMPLETIONS_PATH = '/v1/completions';
const OPENAI_CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

export function preProcessRequest(
  request: Request,
  body: ArrayBuffer | null
): void {
  if (request.url.includes(OPENAI_COMPLETIONS_PATH)) {
    maybeAddModelTag(request, body);
  }
  if (request.url.includes(OPENAI_CHAT_COMPLETIONS_PATH)) {
    maybeAddModelTag(request, body);
  }
}

export function maybeAddModelTag(
  request: Request,
  body: ArrayBuffer | null
): void {
  if (body == null) {
    return;
  }
  let bodyJson: { model: string };
  try {
    bodyJson = JSON.parse(new TextDecoder().decode(body)) as { model: string };
  } catch (e) {
    return;
  }

  if (!Object.hasOwnProperty.call(bodyJson, 'model')) {
    return;
  }

  let header = '';
  const existingHeader = request.headers.get('x-confsec-node-tags');
  const modelTag = `model=${bodyJson.model}`;
  if (existingHeader != null) {
    const hasModelTag = existingHeader.split(',').some(tag => {
      return tag.startsWith('model=');
    });
    if (hasModelTag) {
      header = existingHeader;
    } else {
      header = `${existingHeader},${modelTag}`;
    }
  } else {
    header = modelTag;
  }

  request.headers.set('x-confsec-node-tags', header);
}

export function prepareRequest(
  request: Request,
  body: ArrayBuffer | null
): Buffer {
  const encoder = new TextEncoder();
  const requestComponents: Uint8Array[] = [];

  const url = new URL(request.url);
  // Request line
  requestComponents.push(
    encoder.encode(`${request.method} ${url.pathname} HTTP/1.1\r\n`)
  );
  // Manually insert host header if it's not already present
  if (!request.headers.has('host')) {
    requestComponents.push(encoder.encode(`host: ${url.host}\r\n`));
  }
  // Rest of headers
  request.headers.forEach((value, name) => {
    requestComponents.push(encoder.encode(`${name}: ${value}\r\n`));
  });
  // Manually insert content-length header if it's not already present
  if (body != null && !request.headers.has('content-length')) {
    requestComponents.push(
      encoder.encode(`content-length: ${body.byteLength}\r\n`)
    );
  }
  // End of headers
  requestComponents.push(encoder.encode('\r\n'));

  // Body
  if (body != null) {
    requestComponents.push(new Uint8Array(body));
  }

  return Buffer.concat(requestComponents);
}
