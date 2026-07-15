import axios from 'axios';

export function isLikelyNetworkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  return err.response === undefined;
}
