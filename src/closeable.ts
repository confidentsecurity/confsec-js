export abstract class Closeable {
  private closed: boolean;

  constructor() {
    this.closed = false;
  }

  protected abstract doClose(): void;

  public close() {
    if (this.closed) return;
    this.doClose();
    this.closed = true;
  }
}
