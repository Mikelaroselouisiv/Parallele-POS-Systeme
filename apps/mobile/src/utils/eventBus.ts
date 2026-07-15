import { DeviceEventEmitter } from 'react-native';

export const POS_PENDING_SALES_CHANGED = 'pos-pending-sales-changed';

export function emitPendingSalesChanged(): void {
  DeviceEventEmitter.emit(POS_PENDING_SALES_CHANGED);
}

export function onPendingSalesChanged(callback: () => void): () => void {
  const sub = DeviceEventEmitter.addListener(POS_PENDING_SALES_CHANGED, callback);
  return () => sub.remove();
}
