import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  /** Bords à respecter — les écrans sous un header de Tabs n'ont pas besoin de 'top'. */
  edges?: Edge[];
  /** À activer sur les écrans avec un TextInput pour ne pas laisser le clavier recouvrir le contenu. */
  keyboardAvoiding?: boolean;
};

/**
 * Wrapper commun : zones sécurisées (encoche, barre de gestes/home indicator) +
 * évitement clavier optionnel. À utiliser sur chaque écran plutôt que de gérer
 * SafeAreaView/KeyboardAvoidingView au cas par cas.
 */
export function Screen({ children, style, edges = ['left', 'right'], keyboardAvoiding = false }: ScreenProps) {
  const inner = (
    <SafeAreaView edges={edges} style={[styles.flex, style]}>
      {children}
    </SafeAreaView>
  );

  return (
    <ThemedView style={styles.flex}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
