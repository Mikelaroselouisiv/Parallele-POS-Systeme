import NetInfo from '@react-native-community/netinfo';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

/** Callback appelé à chaque transition hors-ligne → en ligne. */
export function onReconnect(callback: () => void): () => void {
  let wasOffline = false;
  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
    if (online && wasOffline) callback();
    wasOffline = !online;
  });
  return unsubscribe;
}
