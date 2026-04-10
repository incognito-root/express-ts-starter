import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage<string>();

export const runWithRequestId = (requestId: string, fn: () => void): void => {
  storage.run(requestId, fn);
};

export const getRequestId = (): string | undefined => {
  return storage.getStore();
};
