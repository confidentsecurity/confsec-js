export type ClientHandle = number;
export type ResponseHandle = number;
export type ResponseStreamHandle = number;

export interface LibconfsecBinding {
  clientCreate(
    apiKey: string,
    concurrentRequestsTarget: number,
    maxCandidateNodes: number,
    defaultNodeTags: string[],
    env?: string
  ): ClientHandle;

  clientDestroy(clientHandle: ClientHandle): void;

  clientGetMaxCandidateNodes(clientHandle: ClientHandle): number;

  clientGetDefaultCreditAmountPerRequest(clientHandle: ClientHandle): number;

  clientGetDefaultNodeTags(clientHandle: ClientHandle): string[];

  clientSetDefaultNodeTags(
    clientHandle: ClientHandle,
    defaultNodeTags: string[]
  ): void;

  clientGetWalletStatus(clientHandle: ClientHandle): string;

  clientDoRequest(
    clientHandle: ClientHandle,
    request: Uint8Array
  ): ResponseHandle;

  responseDestroy(responseHandle: ResponseHandle): void;

  responseIsStreaming(responseHandle: ResponseHandle): boolean;

  responseGetMetadata(responseHandle: ResponseHandle): string;

  responseGetBody(responseHandle: ResponseHandle): Uint8Array;

  responseGetStream(responseHandle: ResponseHandle): ResponseStreamHandle;

  responseStreamDestroy(responseStreamHandle: ResponseStreamHandle): void;

  responseStreamGetNext(responseStreamHandle: ResponseStreamHandle): Uint8Array;
}

declare const libconfsec: LibconfsecBinding;
export default libconfsec;
