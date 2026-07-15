import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import RNBluetoothClassic, { type BluetoothDevice } from 'react-native-bluetooth-classic';
import { buildEscPosPayload, type SaleReceiptData } from './escpos';
import { getDb } from './db';

export interface SavedPrinter {
  address: string;
  name: string | null;
  paperWidth: 58 | 80;
}

/** Android 12+ exige ces permissions à l'exécution en plus de la déclaration dans app.json. */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

/** Liste uniquement les appareils déjà appairés au niveau OS (pas de flux d'appairage in-app en phase 1). */
export async function listBondedDevices(): Promise<BluetoothDevice[]> {
  return RNBluetoothClassic.getBondedDevices();
}

async function writeBytes(device: BluetoothDevice, bytes: Uint8Array): Promise<void> {
  const base64 = Buffer.from(bytes).toString('base64');
  await device.write(base64, 'base64');
}

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  const row = await getDb().getFirstAsync<{
    device_address: string | null;
    device_name: string | null;
    paper_width: number;
  }>('SELECT device_address, device_name, paper_width FROM printer_settings WHERE id = 1');
  if (!row?.device_address) return null;
  return {
    address: row.device_address,
    name: row.device_name,
    paperWidth: row.paper_width === 80 ? 80 : 58,
  };
}

export async function saveSelectedPrinter(device: { address: string; name: string | null }): Promise<void> {
  const existing = await getSavedPrinter();
  await getDb().runAsync(
    'INSERT OR REPLACE INTO printer_settings (id, device_address, device_name, paper_width) VALUES (1, ?, ?, ?)',
    device.address,
    device.name,
    existing?.paperWidth ?? 58,
  );
}

export async function savePaperWidth(paperWidth: 58 | 80): Promise<void> {
  const existing = await getSavedPrinter();
  await getDb().runAsync(
    'INSERT OR REPLACE INTO printer_settings (id, device_address, device_name, paper_width) VALUES (1, ?, ?, ?)',
    existing?.address ?? null,
    existing?.name ?? null,
    paperWidth,
  );
}

/** Formate le ticket, se connecte à l'imprimante enregistrée, l'écrit, puis déconnecte. */
export async function printReceipt(saleData: SaleReceiptData): Promise<void> {
  const saved = await getSavedPrinter();
  if (!saved) throw new Error('Aucune imprimante Bluetooth configurée');

  const payload = buildEscPosPayload({ ...saleData, paperWidth: saved.paperWidth });
  const device = await RNBluetoothClassic.connectToDevice(saved.address);
  try {
    await writeBytes(device, payload);
  } finally {
    await device.disconnect();
  }
}
