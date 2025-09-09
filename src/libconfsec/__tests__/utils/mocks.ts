import { ILibconfsec } from '../types';

export class MockLibconfsec implements ILibconfsec {
  confsecClientCreate = jest.fn();
  confsecClientDestroy = jest.fn();
  confsecClientGetDefaultCreditAmountPerRequest = jest.fn();
  confsecClientGetMaxCandidateNodes = jest.fn();
  confsecClientGetDefaultNodeTags = jest.fn();
  confsecClientSetDefaultNodeTags = jest.fn();
  confsecClientGetWalletStatus = jest.fn();
  confsecClientDoRequest = jest.fn();

  confsecResponseDestroy = jest.fn();
  confsecResponseGetMetadata = jest.fn();
  confsecResponseIsStreaming = jest.fn();
  confsecResponseGetBody = jest.fn();
  confsecResponseGetStream = jest.fn();

  confsecResponseStreamDestroy = jest.fn();
  confsecResponseStreamGetNext = jest.fn();

  reset(): void {
    this.confsecClientCreate.mockReset();
    this.confsecClientDestroy.mockReset();
    this.confsecClientGetDefaultCreditAmountPerRequest.mockReset();
    this.confsecClientGetMaxCandidateNodes.mockReset();
    this.confsecClientGetDefaultNodeTags.mockReset();
    this.confsecClientSetDefaultNodeTags.mockReset();
    this.confsecClientGetWalletStatus.mockReset();
    this.confsecClientDoRequest.mockReset();

    this.confsecResponseDestroy.mockReset();
    this.confsecResponseGetMetadata.mockReset();
    this.confsecResponseIsStreaming.mockReset();
    this.confsecResponseGetBody.mockReset();
    this.confsecResponseGetStream.mockReset();

    this.confsecResponseStreamDestroy.mockReset();
    this.confsecResponseStreamGetNext.mockReset();
  }
}
