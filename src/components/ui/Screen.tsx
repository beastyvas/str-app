import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { useWorld } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: Edge[];
  /** Render the world motif in a header band behind the top of the screen */
  motifHeader?: boolean;
}

export function Screen({ children, scroll, refreshing, onRefresh, padded = true, edges, motifHeader }: ScreenProps) {
  const world = useWorld();
  const Motif = world.Motif;
  const band = motifHeader ? (
    <View style={styles.band} pointerEvents="none"><Motif intensity="header" /></View>
  ) : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.root} edges={edges}>
        {band}
        <View style={[styles.fill, padded && styles.padded]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {band}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={world.aura} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  fill: { flex: 1 },
  padded: { paddingHorizontal: Spacing.screenH },
  scrollContent: { paddingBottom: 60 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, overflow: 'hidden' },
});
