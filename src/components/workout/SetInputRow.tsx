import { memo, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText, IconSymbol } from '@/components/ui';
import { Colors, Hit, Radius, Spacing, onColor } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useWorld } from '@/theme';
import { toDisplay, toLbs, unitFromProfile } from '@/lib/units';
import type { LoggedSet } from '@/hooks/useWorkout';
import {
  WeightMode, PlateSystem, PLATE_CONFIGS, defaultModeForEquipment, describeWeight,
} from '@/lib/plateUtils';
import { grid } from './setGrid';
import { SetNoteSheet } from './SetNoteSheet';
import { PlateControls } from './PlateControls';

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      style={[styles.step, disabled && styles.off]}
      accessibilityLabel={label}
    >
      <AppText variant="stat" color={Colors.textSecondary} style={styles.stepText}>{label}</AppText>
    </TouchableOpacity>
  );
}

function Toggle({ label, on, onPress, color }: { label: string; on: boolean; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.toggle, on && { borderColor: color, backgroundColor: color + '1F' }]}
      accessibilityState={{ selected: on }}
    >
      <AppText variant="label" color={on ? color : Colors.textMuted}>{label}</AppText>
    </TouchableOpacity>
  );
}

/**
 * The NEXT unlogged set — the workout's hero row: aura left rule, surface2
 * fill, ≥56pt controls. Logging keeps weight/reps (the next set is usually
 * the same load). memo'd: only re-renders on its own props.
 */
export const SetInputRow = memo(function SetInputRow({
  setNumber,
  prevSet,
  equipmentType,
  onLog,
}: {
  setNumber: number;
  prevSet?: LoggedSet;
  equipmentType?: string;
  onLog: (data: { weight: number; reps: number; rpe?: number; note?: string; isWarmup?: boolean }) => Promise<{ isPR: boolean } | void>;
}) {
  const world = useWorld();
  // Storage is lbs; everything typed/shown here is in the user's unit
  const { profile } = useAuth();
  const unit = unitFromProfile(profile?.unit_pref);

  const defaultMode = prevSet?.weight === 0 ? 'bw' : defaultModeForEquipment(equipmentType);
  const [mode, setMode] = useState<WeightMode>(defaultMode);
  const [plateSystem, setPlateSystem] = useState<PlateSystem>(unit);
  // Pre-fill from the last time this set number was logged — just a head start
  const [weight, setWeight] = useState(
    defaultMode === 'bw' ? '' :
    defaultMode === 'plates' ? String(prevSet?.weight ? Math.max(PLATE_CONFIGS[unit].barWeight, toDisplay(prevSet.weight, unit)) : PLATE_CONFIGS[unit].barWeight) :
    prevSet ? String(toDisplay(prevSet.weight, unit)) : ''
  );
  const [reps, setReps] = useState(prevSet ? String(prevSet.reps) : '');
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [isWarmup, setIsWarmup] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const savedNumericWeight = useRef(weight);

  const cfg = PLATE_CONFIGS[plateSystem];
  const plateWeight = parseFloat(weight) || cfg.barWeight;

  const adjustPlates = (plateSize: number, direction: 1 | -1) => {
    const next = Math.max(cfg.barWeight, plateWeight + plateSize * 2 * direction); // both sides
    setWeight(String(Math.round(next * 10) / 10));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cycleMode = () => {
    if (mode === 'number') {
      if (weight) savedNumericWeight.current = weight; // preserve before leaving
      setMode('bw');
      setWeight('');
    } else if (mode === 'bw') {
      setMode('plates');
      setWeight(String(cfg.barWeight));
    } else {
      setMode('number');
      setWeight(savedNumericWeight.current);
    }
  };

  const getWeight = () => (mode === 'bw' ? 0 : mode === 'plates' ? plateWeight : parseFloat(weight));

  const canLog = (() => {
    const r = parseInt(reps);
    if (!r || r <= 0) return false;
    if (mode === 'bw') return true;
    if (mode === 'plates') return plateWeight >= cfg.barWeight;
    return !!weight && parseFloat(weight) >= 0;
  })();

  const handleLog = async () => {
    if (!canLog) return;
    // Plates mode is in the plate system's unit; number mode in the user's.
    const w = toLbs(getWeight(), mode === 'plates' ? plateSystem : unit);
    setLogging(true);
    try {
      await onLog({ weight: w, reps: parseInt(reps), rpe, note: note.trim() || undefined, isWarmup });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setNote('');
      setNoteOpen(false);
      setRpe(undefined);
      setShowRpe(false);
      setIsWarmup(false);
    } finally {
      setLogging(false);
    }
  };

  const modeHint = mode === 'bw'
    ? 'Bodyweight set'
    : mode === 'plates'
    ? plateWeight === cfg.barWeight
      ? `${cfg.barWeight} ${cfg.label} = empty bar`
      : describeWeight(plateWeight, cfg)
    : null;

  // Steppers — adjust load/reps with sweaty hands, no keyboard mid-set
  const weightStep = unit === 'kg' ? 2.5 : 5;
  const stepWeight = (dir: 1 | -1) => {
    const next = Math.max(0, Math.round(((parseFloat(weight) || 0) + dir * weightStep) * 10) / 10);
    setWeight(String(next));
    Haptics.selectionAsync().catch(() => {});
  };
  const stepReps = (dir: 1 | -1) => {
    const next = Math.max(0, (parseInt(reps) || 0) + dir);
    setReps(next ? String(next) : '');
    Haptics.selectionAsync().catch(() => {});
  };

  // Tap "last" to load last session's numbers for this set
  const applyGhost = () => {
    if (!prevSet) return;
    if (prevSet.weight === 0) { setMode('bw'); setWeight(''); }
    else { setMode('number'); setWeight(String(toDisplay(prevSet.weight, unit))); }
    setReps(String(prevSet.reps));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.rule, { backgroundColor: world.aura }]} />
      <View style={grid.row}>
        <AppText variant="stat" color={world.aura} style={[grid.setNo, styles.setNo]}>{setNumber}</AppText>

        <TouchableOpacity onPress={applyGhost} disabled={!prevSet} style={[grid.last, styles.lastBtn]} accessibilityLabel="Fill last session's set">
          {prevSet ? (
            <>
              <AppText variant="label" color={Colors.textSecondary} numberOfLines={1} mono>
                {prevSet.weight === 0 ? 'BW' : toDisplay(prevSet.weight, unit)}×{prevSet.reps}
              </AppText>
              <AppText variant="caption" color={world.aura}>{prevSet.rpe ? `@${prevSet.rpe} · ` : ''}Fill</AppText>
            </>
          ) : (
            <AppText variant="caption">—</AppText>
          )}
        </TouchableOpacity>

        <View style={grid.weight}>
          {mode === 'bw' ? (
            <View style={[grid.input, grid.inputBox]}>
              <AppText variant="stat" color={Colors.success}>BW</AppText>
            </View>
          ) : mode === 'plates' ? (
            <View style={[grid.input, grid.inputBox]}>
              <AppText variant="stat">{plateWeight}</AppText>
            </View>
          ) : (
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              style={grid.input}
              selectTextOnFocus
              accessibilityLabel={`Weight in ${unit}`}
            />
          )}
        </View>

        <AppText variant="stat" color={Colors.textMuted} style={grid.times}>×</AppText>

        <View style={grid.reps}>
          <TextInput
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            style={grid.input}
            selectTextOnFocus
            accessibilityLabel="Reps"
          />
        </View>

        <View style={grid.check}>
          <TouchableOpacity
            onPress={handleLog}
            disabled={!canLog || logging}
            style={[styles.logBtn, { backgroundColor: canLog && !logging ? world.aura : Colors.surface3 }]}
            accessibilityRole="button"
            accessibilityLabel="Log set"
          >
            {logging
              ? <AppText variant="label" color={Colors.textMuted}>···</AppText>
              : <IconSymbol name="check" size={26} color={canLog ? onColor(world.aura) : Colors.textMuted} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Steppers under weight and reps */}
      <View style={[grid.row, styles.steps]}>
        <View style={grid.setNo} />
        <View style={grid.last} />
        <View style={[grid.weight, styles.stepPair]}>
          {mode === 'number' && (
            <>
              <StepButton label={`−${weightStep}`} onPress={() => stepWeight(-1)} disabled={!(parseFloat(weight) > 0)} />
              <StepButton label={`+${weightStep}`} onPress={() => stepWeight(1)} />
            </>
          )}
        </View>
        <View style={grid.times} />
        <View style={[grid.reps, styles.stepPair]}>
          <StepButton label="−1" onPress={() => stepReps(-1)} disabled={!(parseInt(reps) > 0)} />
          <StepButton label="+1" onPress={() => stepReps(1)} />
        </View>
        <View style={grid.check} />
      </View>

      {modeHint && <AppText variant="caption" style={styles.hint}>{modeHint}</AppText>}

      {/* Note (coach reads these), RPE, warmup, weight mode */}
      <View style={styles.extras}>
        <TouchableOpacity onPress={() => setNoteOpen(true)} style={[styles.note, !!note && { borderColor: world.aura }]}>
          <IconSymbol name="comment" size={14} color={note ? world.aura : Colors.textMuted} />
          <AppText variant="label" color={note ? Colors.text : Colors.textMuted} numberOfLines={1} style={styles.flex}>
            {note || 'Add a note'}
          </AppText>
        </TouchableOpacity>
        <Toggle label={rpe ? `@${rpe}` : 'RPE'} on={!!rpe || showRpe} onPress={() => setShowRpe(!showRpe)} color={world.aura} />
        <Toggle label="Warmup" on={isWarmup} onPress={() => setIsWarmup(w => !w)} color={world.auraAlt} />
        <Toggle label={mode === 'number' ? unit : mode === 'bw' ? 'BW' : 'Bar'} on={mode !== 'number'} onPress={cycleMode} color={world.aura} />
      </View>

      {mode === 'plates' && (
        <PlateControls
          plateWeight={plateWeight}
          plateSystem={plateSystem}
          onAdjust={adjustPlates}
          onSwitchSystem={() => {
            const next: PlateSystem = plateSystem === 'lbs' ? 'kg' : 'lbs';
            setPlateSystem(next);
            setWeight(String(PLATE_CONFIGS[next].barWeight));
          }}
        />
      )}

      {showRpe && (
        <View style={styles.rpeRow}>
          {RPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => { setRpe(opt); setShowRpe(false); }}
              style={[styles.rpe, rpe === opt && { backgroundColor: world.aura, borderColor: world.aura }]}
            >
              <AppText variant="stat" color={rpe === opt ? onColor(world.aura) : Colors.text} style={styles.rpeText}>{opt}</AppText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setRpe(undefined); setShowRpe(false); }} style={styles.rpe}>
            <AppText variant="label">Clear</AppText>
          </TouchableOpacity>
        </View>
      )}

      <SetNoteSheet visible={noteOpen} note={note} onChange={setNote} onClose={() => setNoteOpen(false)} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.surface2, paddingVertical: Spacing.sm },
  rule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  setNo: { fontSize: 18 },
  lastBtn: { minHeight: Hit.min, justifyContent: 'center' },
  logBtn: { width: Hit.log, height: Hit.log, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  steps: { minHeight: 44 },
  stepPair: { flexDirection: 'row', gap: 6 },
  step: {
    flex: 1, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { fontSize: 14, lineHeight: 18 },
  off: { opacity: 0.35 },
  hint: { paddingHorizontal: Spacing.lg, paddingBottom: 4 },
  extras: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  note: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: Hit.min,
    paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  flex: { flex: 1 },
  toggle: {
    minHeight: Hit.min, minWidth: 48, paddingHorizontal: Spacing.sm, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  rpe: {
    minWidth: 52, minHeight: Hit.min, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  rpeText: { fontSize: 16, lineHeight: 20 },
});
