import { Alert, Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { Spacing } from '@/constants/theme';

export function LogoutButton() {
  const { logout } = useAuth();

  function confirmLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <Pressable onPress={confirmLogout} hitSlop={12} style={styles.button}>
      <ThemedText type="link" themeColor="text">
        Déconnexion
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
});
