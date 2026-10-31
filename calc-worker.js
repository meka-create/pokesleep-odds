import { calculateAll } from './calculator.mjs';
self.onmessage = event => {
  const { id, state } = event.data;
  try { self.postMessage({ id, ok: true, result: calculateAll(state) }); }
  catch (error) { self.postMessage({ id, ok: false, error: String(error?.message || error) }); }
};
