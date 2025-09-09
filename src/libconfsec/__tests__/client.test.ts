import { ConfsecClient } from '../client';
import { MockLibconfsec } from './utils/mocks';

describe('ConfsecClient initialization', () => {
  test('passes params to confsecClientCreate', () => {
    const mockLibconfsec = new MockLibconfsec();
    const apiKey = 'my-api-key';
    const concurrentRequestsTarget = 11;
    const maxCandidateNodes = 22;
    const defaultNodeTags = ['tag1', 'tag2'];
    const env = 'test';
    new ConfsecClient({
      apiKey,
      concurrentRequestsTarget,
      maxCandidateNodes,
      defaultNodeTags,
      env,
      libconfsec: mockLibconfsec,
    });
    expect(mockLibconfsec.confsecClientCreate).toHaveBeenCalledWith(
      'my-api-key',
      concurrentRequestsTarget,
      maxCandidateNodes,
      defaultNodeTags,
      env
    );
  });

  test('default params', () => {
    const mockLibconfsec = new MockLibconfsec();
    new ConfsecClient({
      apiKey: 'my-api-key',
      libconfsec: mockLibconfsec,
    });
    expect(mockLibconfsec.confsecClientCreate).toHaveBeenCalledWith(
      'my-api-key',
      10,
      5,
      [],
      'prod'
    );
  });
});

describe('Wallet status', () => {
  test('getWalletStatus parses JSON correctly', () => {
    const mockLibconfsec = new MockLibconfsec();
    mockLibconfsec.confsecClientGetWalletStatus.mockReturnValue(
      JSON.stringify({
        credits_spent: 1,
        credits_held: 2,
        credits_available: 3,
      })
    );
    const client = new ConfsecClient({
      apiKey: 'my-api-key',
      libconfsec: mockLibconfsec,
    });
    expect(client.getWalletStatus()).toEqual({
      credits_spent: 1,
      credits_held: 2,
      credits_available: 3,
    });
    expect(mockLibconfsec.confsecClientGetWalletStatus).toHaveBeenCalledWith(
      client.handle
    );
  });
});

describe('Resource Management', () => {
  test('close calls confsecClientDestroy', () => {
    const mockLibconfsec = new MockLibconfsec();
    const client = new ConfsecClient({
      apiKey: 'my-api-key',
      libconfsec: mockLibconfsec,
    });
    client.close();
    expect(mockLibconfsec.confsecClientDestroy).toHaveBeenCalledWith(
      client.handle
    );
  });

  test('multiple close calls are safe', () => {
    const mockLibconfsec = new MockLibconfsec();
    const client = new ConfsecClient({
      apiKey: 'my-api-key',
      libconfsec: mockLibconfsec,
    });
    client.close();
    client.close();
    expect(mockLibconfsec.confsecClientDestroy).toHaveBeenCalledTimes(1);
    expect(mockLibconfsec.confsecClientDestroy).toHaveBeenCalledWith(
      client.handle
    );
  });
});
