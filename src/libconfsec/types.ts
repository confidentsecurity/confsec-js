// Type definitions for the native libconfsec module

export const enum IdentityPolicySource {
  CONFIGURED = 0,
  UNSAFE_REMOTE = 1,
}

export interface ILibconfsec {
  /**
   * Create a new CONFSEC client
   * @param apiUrl - The URL for the auth API
   * @param apiKey - The API key for authentication
   * @param identityPolicySource - Source of identity policy (CONFIGURED or UNSAFE_REMOTE)
   * @param oidcIssuer - OIDC issuer string
   * @param oidcIssuerRegex - Regex for matching OIDC issuer
   * @param oidcSubject - OIDC subject string
   * @param oidcSubjectRegex - Regex for matching OIDC subject
   * @param concurrentRequestsTarget - Target number of concurrent requests
   * @param maxCandidateNodes - Maximum number of candidate nodes to consider
   * @param defaultNodeTags - Array of default node tags
   * @param env - Environment string (optional)
   * @returns Handle to the created client
   */
  confsecClientCreate(
    apiUrl: string,
    apiKey: string,
    identityPolicySource: IdentityPolicySource,
    oidcIssuer: string,
    oidcIssuerRegex: string,
    oidcSubject: string,
    oidcSubjectRegex: string,
    concurrentRequestsTarget: number,
    maxCandidateNodes: number,
    defaultNodeTags: string[],
    env?: string | null
  ): number;

  /**
   * Destroy a CONFSEC client
   * @param handle - Handle to the client
   */
  confsecClientDestroy(handle: number): void;

  /**
   * Get the default credit amount per request for a client
   * @param handle - Handle to the client
   * @returns Default credit amount
   */
  confsecClientGetDefaultCreditAmountPerRequest(handle: number): number;

  /**
   * Get the maximum number of candidate nodes for a client
   * @param handle - Handle to the client
   * @returns Maximum candidate nodes
   */
  confsecClientGetMaxCandidateNodes(handle: number): number;

  /**
   * Get the default node tags for a client
   * @param handle - Handle to the client
   * @returns Array of default node tags
   */
  confsecClientGetDefaultNodeTags(handle: number): string[];

  /**
   * Set the default node tags for a client
   * @param handle - Handle to the client
   * @param defaultNodeTags - Array of node tags to set
   */
  confsecClientSetDefaultNodeTags(
    handle: number,
    defaultNodeTags: string[]
  ): void;

  /**
   * Get the wallet status for a client
   * @param handle - Handle to the client
   * @returns Wallet status as JSON string
   */
  confsecClientGetWalletStatus(handle: number): string;

  /**
   * Send a request through the CONFSEC network
   * @param handle - Handle to the client
   * @param request - The HTTP request as string or buffer
   * @returns Handle to the response
   */
  confsecClientDoRequest(handle: number, request: string | Buffer): number;

  /**
   * Destroy a response object
   * @param handle - Handle to the response
   */
  confsecResponseDestroy(handle: number): void;

  /**
   * Get metadata (headers) from a response
   * @param handle - Handle to the response
   * @returns Response metadata as buffer
   */
  confsecResponseGetMetadata(handle: number): Buffer;

  /**
   * Check if a response is streaming
   * @param handle - Handle to the response
   * @returns True if streaming, false otherwise
   */
  confsecResponseIsStreaming(handle: number): boolean;

  /**
   * Get the body of a non-streaming response
   * @param handle - Handle to the response
   * @returns Response body as buffer
   */
  confsecResponseGetBody(handle: number): Buffer;

  /**
   * Get a stream handle for a streaming response
   * @param handle - Handle to the response
   * @returns Handle to the stream
   */
  confsecResponseGetStream(handle: number): number;

  /**
   * Get the next chunk from a response stream
   * @param handle - Handle to the stream
   * @returns Next chunk as buffer, or null if no more chunks
   */
  confsecResponseStreamGetNext(handle: number): Buffer | null;

  /**
   * Destroy a response stream
   * @param handle - Handle to the stream
   */
  confsecResponseStreamDestroy(handle: number): void;
}
