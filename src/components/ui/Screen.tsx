import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: Edge[];
}

export function Screen({ children, scroll, refreshing, onRefresh, padded = true, edges }: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.root} edges={edges}>
        <View style={[styles.fill, padded && styles.padded]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
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
});
