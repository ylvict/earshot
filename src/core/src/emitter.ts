type AnyFn = (...args: any[]) => any;

export class Emitter<E extends Record<keyof E, AnyFn>> {
  private map = new Map<keyof E, Set<AnyFn>>();

  on<K extends keyof E>(event: K, fn: E[K]): () => void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(fn as AnyFn);
    return () => this.off(event, fn);
  }

  off<K extends keyof E>(event: K, fn: E[K]): void {
    const set = this.map.get(event);
    if (!set) return;
    set.delete(fn as AnyFn);
  }

  emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as AnyFn)(...args);
  }
}