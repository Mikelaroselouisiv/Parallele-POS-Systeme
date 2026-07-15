import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';

import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getSavedPrinter,
  listBondedDevices,
  printReceipt,
  requestBluetoothPermissions,
  savePaperWidth,
  saveSelectedPrinter,
  type SavedPrinter,
} from '@/services/bluetooth-printer';
import { buildSaleReceiptData } from '@/services/receipt';

export default function PrinterSettingsScreen() {
  const { user } = useAuth();
  const departmentId = typeof user?.departmentId === 'number' ? user.departmentId : undefined;

  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [saved, setSaved] = useState<SavedPrinter | null>(null);
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refreshSaved = useCallback(() => {
    getSavedPrinter().then(setSaved).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  async function scan() {
    setScanning(true);
    setStatus(null);
    try {
      const granted = await requestBluetoothPermissions();
      if (!granted) {
        setStatus('Permissions Bluetooth refusées');
        return;
      }
      setDevices(await listBondedDevices());
    } catch {
      setStatus("Impossible de lister les appareils — Bluetooth activé ?");
    } finally {
      setScanning(false);
    }
  }

  async function selectDevice(device: BluetoothDevice) {
    await saveSelectedPrinter({ address: device.address, name: device.name });
    refreshSaved();
    setStatus(`Imprimante enregistrée : ${device.name ?? device.address}`);
  }

  async function setPaperWidth(width: 58 | 80) {
    await savePaperWidth(width);
    refreshSaved();
  }

  async function testPrint() {
    setTesting(true);
    setStatus(null);
    try {
      const receiptData = await buildSaleReceiptData({
        items: [],
        total: 0,
        paymentMode: 'CASH',
        cashier: user?.fullName || user?.phone,
        departmentId,
        isTest: true,
      });
      await printReceipt({ ...receiptData, previewSampleBody: receiptData.previewSampleBody || 'Ticket de test' });
      setStatus('Ticket test envoyé');
    } catch {
      setStatus("Échec de l'impression — vérifiez la connexion Bluetooth");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen style={styles.container}>
      {status && (
        <ThemedView type="backgroundElement" style={styles.status}>
          <ThemedText type="small">{status}</ThemedText>
        </ThemedView>
      )}

      <View style={styles.section}>
        <ThemedText type="smallBold">Imprimante actuelle</ThemedText>
        <ThemedText themeColor="textSecondary">
          {saved ? `${saved.name ?? 'Sans nom'} (${saved.address})` : 'Aucune imprimante configurée'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Largeur papier
        </ThemedText>
        <View style={styles.row}>
          {([58, 80] as const).map((width) => (
            <Pressable
              key={width}
              onPress={() => setPaperWidth(width)}
              style={[styles.widthButton, saved?.paperWidth === width && styles.widthButtonActive]}>
              <ThemedText>{width}mm</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={styles.button} onPress={scan} disabled={scanning}>
        {scanning ? <ActivityIndicator /> : <ThemedText style={styles.buttonText}>Rechercher (appairés)</ThemedText>}
      </Pressable>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.address}
        style={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.deviceRow} onPress={() => selectDevice(item)}>
            <ThemedText>{item.name || 'Sans nom'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.address}
            </ThemedText>
          </Pressable>
        )}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.emptyList}>
            Aucun appareil — appairez l&apos;imprimante dans les réglages Bluetooth du téléphone
            puis appuyez sur Rechercher.
          </ThemedText>
        }
      />

      <Pressable
        style={[styles.button, styles.testButton, (!saved || testing) && styles.buttonDisabled]}
        onPress={testPrint}
        disabled={!saved || testing}>
        {testing ? <ActivityIndicator color="#ffffff" /> : <ThemedText style={styles.buttonText}>Ticket test</ThemedText>}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  status: { padding: Spacing.two, borderRadius: Spacing.two },
  section: { gap: Spacing.one },
  sectionTitle: { marginBottom: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two },
  widthButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#8886',
    alignItems: 'center',
  },
  widthButtonActive: { backgroundColor: '#208AEF33', borderColor: '#208AEF' },
  button: {
    backgroundColor: '#208AEF',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  testButton: { marginTop: 'auto' },
  list: { flex: 1 },
  deviceRow: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8886',
  },
  emptyList: { paddingVertical: Spacing.four, textAlign: 'center' },
});
