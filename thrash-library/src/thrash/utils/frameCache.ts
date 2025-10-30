export interface CachedFrame<T> {
  id: string;
  payload: T;
  createdAt: number;
}

class FrameCache<T> {
  private store = new Map<string, CachedFrame<T>>();
  private counter = 0;

  public createId(prefix: string = 'frame'): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  public get(id: string): CachedFrame<T> | undefined {
    return this.store.get(id);
  }

  public set(id: string, payload: T): CachedFrame<T> {
    const entry: CachedFrame<T> = { id, payload, createdAt: Date.now() };
    this.store.set(id, entry);
    return entry;
  }

  public delete(id: string): boolean {
    return this.store.delete(id);
  }

  public clear(): void {
    this.store.clear();
  }
}

export const frameCache = new FrameCache<HTMLCanvasElement>();

