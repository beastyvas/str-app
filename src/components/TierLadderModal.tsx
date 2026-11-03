import { Dimensions, ScrollView, StyleSheet } from 'react-native';
import { AppText, SheetModal } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { unitFromProfile } from '@/lib/units';
import { RankResult } from '@/constants/ranks';
import { WorldLadder } from '@/components/power/WorldLadder';

const SHEET_H = Math.round(Dimensions.get('window').height * 0.88);

interface Props {
  visible: boolean;
  onClose: () => void;
  result: RankResult | null;
  bodyweightLbs?: number;
  gender?: 'male' | 'female' | 'other' | null;
}

/**
 * The rank ladder: six worlds as vertical bands — motif, aura, lead portrait
 * (silhouetted until reached), my position as a glowing tick, and the
 * sub-tier thresholds for my bodyweight per lift.
 */
export function TierLadderModal({ visible, onClose, result, bodyweightLbs, gender }: Props) {
  const { profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);
  return (
    <SheetModal visible={visible} onClose={onClose} title="Rank ladder" snapHeight={SHEET_H} keyboardAware={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AppText variant="body">
          Each rank is a world. Your rank follows your weakest lift; your Power Level is the average.
        </AppText>
        <WorldLadder result={result} bodyweightLbs={bodyweightLbs ?? 185} gender={gender} unit={unit} showThresholds />
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.lg, paddingBottom: Spacing.xxl },
});
