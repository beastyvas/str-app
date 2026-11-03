import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { MangaPanel, PowerReadout, RankUpScene, fireImpact } from '@/components/anime';
import { Colors, Spacing } from '@/constants/theme';
import { RANK_TIERS } from '@/constants/ranks';
import { WORLD_LIST, WorldScope, type WorldTheme } from '@/theme';

/**
 * __DEV__-only preview of all six worlds: motif, panel, buttons, Power Level
 * readout, and rank-up scene. Open from Profile (dev builds) or str://dev/worlds.
 */
export default function DevWorlds() {
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/(tabs)" />;
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <AppText variant="display">Worlds</AppText>
        <Button label="Close" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {WORLD_LIST.map((w, i) => (
          <WorldScope key={w.key} world={w}>
            <WorldPreview world={w} power={1100 + i * 1500} />
          </WorldScope>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorldPreview({ world, power }: { world: WorldTheme; power: number }) {
  const [play, setPlay] = useState(0);
  const tier = RANK_TIERS.find(t => t.key === world.key)!;
  return (
    <View style={styles.world}>
      <AppText variant="title" color={world.aura}>{tier.label}</AppText>
      <AppText variant="caption">{world.series} · readout {world.powerReadout} · scene {world.rankUpScene}</AppText>

      <MangaPanel motif="hero">
        <View style={styles.center}>
          <PowerReadout power={power} menace={world.key === 'phantom'} size={220} />
        </View>
      </MangaPanel>

      <View style={styles.row}>
        <Button label="Start workout" onPress={() => {}} />
        <Button label="Tinted" variant="tinted" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
      </View>

      <View style={styles.scene}>
        <RankUpScene world={world} playKey={play} />
        <View style={styles.sceneLabel}>
          <AppText variant="display" color={world.aura}>{tier.label} I</AppText>
        </View>
      </View>
      <View style={styles.row}>
        <Button label="Replay rank-up" variant="secondary" size="sm" onPress={() => setPlay(p => p + 1)} />
        <Button label="Impact frame" variant="secondary" size="sm" onPress={() => fireImpact(world.aura, world.sfx.pr)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.screenH, paddingVertical: Spacing.md },
  scroll: { padding: Spacing.screenH, gap: 48, paddingBottom: 80 },
  world: { gap: Spacing.md },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  scene: { height: 320, overflow: 'hidden', backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  sceneLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
