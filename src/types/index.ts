export interface ConfsecConfig {
  concurrentRequestsTarget?: number;
  maxCandidateNodes?: number;
  defaultNodeTags?: string[];
  env?: string;
}

export interface WalletStatus {
  creditsSpent: number;
  creditsHeld: number;
  creditsAvailable: number;
}

export interface KV {
  key: string;
  value: string;
}

export interface ResponseMetadata {
  statusCode: number;
  reasonPhrase: string;
  httpVersion: string;
  url: string;
  headers: KV[];
}

export type HttpClientType = 'httpx';

export * from './native';
