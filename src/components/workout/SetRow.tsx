import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, Pressable, Alert, ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { LoggedSet } from '@/hooks/useWorkout';
import {
  WeightMode, PlateSystem, PLATE_CONFIGS, defaultModeForEquipment, describeWeight,
} from '@/lib/plateUtils';

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export function SetInputRow({
  setNumber,
  prevSet,
  equipmentType,
  onLog,
}: {
  setNumber: number;
  prevSet?: LoggedSet;
  equipmentType?: string;
  onLog: (data: { weight: number; reps: number; rpe?: number; note?: string; isWarmup?: boolean }) => Promise<void>;
}) {
  const defaultMode = prevSet?.weight === 0
    ? 'bw'
    : defaultModeForEquipment(equipmentType);

  const [mode, setMode] = useState<WeightMode>(defaultMode);
  const [plateSystem, setPlateSystem] = useState<PlateSystem>('lbs');
  // Pre-fill from the last time this set number was logged — editable, just a head start
  const [weight, setWeight] = useState(
    defaultMode === 'bw' ? '' :
    defaultMode === 'plates' ? String(prevSet?.weight ?? PLATE_CONFIGS.lbs.barWeight) :
    prevSet ? String(prevSet.weight) : ''
  );
  const [reps, setReps] = useState(prevSet ? String(prevSet.reps) : '');
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [isWarmup, setIsWarmup] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const savedNumericWeight = useRef(weight);

  const cfg = PLATE_CONFIGS[plateSystem];
  const plateWeight = parseFloat(weight) || cfg.barWeight;

  const adjustPlates = (plateSize: number, direction: 1 | -1) => {
    const delta = plateSize * 2 * direction; // both sides
    const next = Math.max(cfg.barWeight, plateWeight + delta);
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
      setWeight(savedNumericWeight.current); // restore saved weight
    }
  };

  const getWeight = () => {
    if (mode === 'bw') return 0;
    if (mode === 'plates') return plateWeight;
    return parseFloat(weight);
  };

  const canLog = () => {
    const r = parseInt(reps);
    if (!r || r <= 0) return false;
    if (mode === 'bw') return true;
    if (mode === 'plates') return plateWeight >= cfg.barWeight;
    return !!weight && parseFloat(weight) >= 0;
  };

  const handleLog = async () => {
    if (!canLog()) return;
    const w = getWeight();
    const r = parseInt(reps);
    setLogging(true);
    try {
      await onLog({ weight: w, reps: r, rpe, note: note.trim() || undefined, isWarmup });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setNote('');
      setNoteOpen(false);
    } finally {
      setLogging(false);
    }
  };

  const inputStyle = {
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    paddingVertical: 10,
    letterSpacing: -1,
  };

  // Mode hint shown below the input row
  const modeHint = mode === 'bw'
    ? 'Your bodyweight is recorded as the weight'
    : mode === 'plates'
    ? plateWeight === cfg.barWeight
      ? `${cfg.barWeight} ${cfg.label} = empty bar · tap +${cfg.plateOptions[0]} to add plates`
      : describeWeight(plateWeight, cfg)
    : null;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ color: Colors.textMuted, fontSize: 13, width: 22, textAlign: 'center', fontWeight: '700' }}>
          {setNumber}
        </Text>

        {/* Weight — switches by mode */}
        <View style={{ flex: 1.6 }}>
          {mode === 'bw' ? (
            <View style={[inputStyle, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: Colors.success, fontSize: 22, fontWeight: '900' }}>BW</Text>
            </View>
          ) : mode === 'plates' ? (
            <View style={[inputStyle, { justifyContent: 'center', alignItems: 'center', paddingVertical: 6 }]}>
              <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 }}>
                {plateWeight}
              </Text>
              <Text style={{ color: Colors.textMuted, fontSize: 9 }}>{cfg.label}</Text>
            </View>
          ) : (
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              style={inputStyle}
              selectTextOnFocus
            />
          )}
        </View>

        <Text style={{ color: Colors.textMuted, fontSize: 18, fontWeight: '300' }}>×</Text>

        <View style={{ flex: 1 }}>
          <TextInput
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            style={inputStyle}
            selectTextOnFocus
          />
        </View>

        {/* Expand RPE/note — hidden by default, clean for new users */}
        <TouchableOpacity
          onPress={() => setShowExtras(!showExtras)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            paddingHorizontal: 8, paddingVertical: 10,
            opacity: (rpe || note) ? 1 : 0.5,
          }}
        >
          <Text style={{ color: (rpe || note) ? Colors.accent : Colors.textMuted, fontSize: 13 }}>
            {(rpe || note) ? '●' : '···'}
          </Text>
        </TouchableOpacity>

        {/* Mode cycle — small, tucked */}
        <TouchableOpacity
          onPress={cycleMode}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          style={{
            backgroundColor: mode !== 'number' ? Colors.accentDim : Colors.surface2,
            borderRadius: 6, paddingHorizontal: 6, paddingVertical: 5,
            borderWidth: 1,
            borderColor: mode !== 'number' ? Colors.accent + '60' : Colors.border,
          }}
        >
          <Text style={{ color: mode !== 'number' ? Colors.accent : Colors.textMuted, fontSize: 8, fontWeight: '900' }}>
            {mode === 'number' ? 'lbs' : mode === 'bw' ? 'BW' : '🏋️'}
          </Text>
        </TouchableOpacity>

        {/* Warmup toggle */}
        <TouchableOpacity
          onPress={() => setIsWarmup(w => !w)}
          style={{
            backgroundColor: isWarmup ? '#F97316' + '25' : Colors.surface2,
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 10,
            borderWidth: 1, borderColor: isWarmup ? '#F97316' + '60' : Colors.border,
            minWidth: 32, alignItems: 'center',
          }}
        >
          <Text style={{ color: isWarmup ? '#F97316' : Colors.textMuted, fontSize: 11, fontWeight: '900' }}>W</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLog}
          disabled={!canLog() || logging}
          style={{
            backgroundColor: canLog() && !logging ? Colors.accent : Colors.surface2,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            minWidth: 54,
            alignItems: 'center',
            shadowColor: canLog() && !logging ? Colors.accent : 'transparent',
            shadowOpacity: 0.4,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: canLog() && !logging ? 5 : 0,
          }}
        >
          <Text style={{
            color: canLog() && !logging ? Colors.text : Colors.textMuted,
            fontWeight: '900',
            fontSize: 12,
            letterSpacing: 0.5,
          }}>
            {logging ? '···' : 'LOG'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode hint — explains BW and plates to new users */}
      {modeHint && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <Text style={{ color: Colors.accent + 'CC', fontSize: 10, fontStyle: 'italic' }}>
            {modeHint}
          </Text>
        </View>
      )}

      {/* Extras — RPE and note, only shown when expanded */}
      {showExtras && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setShowRpe(!showRpe)}
            style={{
              backgroundColor: rpe ? Colors.accentDim : Colors.surface2,
              borderRadius: 8, borderWidth: 1,
              borderColor: rpe ? Colors.accent : Colors.border,
              paddingHorizontal: 12, paddingVertical: 7, minWidth: 52, alignItems: 'center',
            }}
          >
            <Text style={{ color: rpe ? Colors.accent : Colors.textMuted, fontSize: 11, fontWeight: '700' }}>
              {rpe ? `RPE ${rpe}` : 'RPE'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setNoteOpen(true)}
            style={{
              backgroundColor: note ? Colors.accentDim : Colors.surface2,
              borderRadius: 8, borderWidth: 1,
              borderColor: note ? Colors.accent : Colors.border,
              paddingHorizontal: 12, paddingVertical: 7, flex: 1,
            }}
          >
            <Text style={{ color: note ? Colors.accent : Colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {note || 'Add note...'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Plate controls — shown when in plates mode */}
      {mode === 'plates' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
          {/* Plate system toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, flex: 1 }}>
              {describeWeight(plateWeight, cfg)}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const next: PlateSystem = plateSystem === 'lbs' ? 'kg' : 'lbs';
                setPlateSystem(next);
                setWeight(String(PLATE_CONFIGS[next].barWeight));
              }}
              style={{
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: 6, borderWidth: 1, borderColor: Colors.border,
              }}
            >
              <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                {plateSystem === 'lbs' ? 'Switch to kg' : 'Switch to lbs'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Add/remove plate buttons */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {cfg.plateOptions.map(p => (
              <View key={p} style={{ flex: 1, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => adjustPlates(p, 1)}
                  style={{
                    backgroundColor: Colors.surface2, borderRadius: 6,
                    paddingVertical: 6, alignItems: 'center',
                    borderWidth: 1, borderColor: Colors.border,
                  }}
                >
                  <Text style={{ color: Colors.text, fontSize: 11, fontWeight: '700' }}>+{p}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => adjustPlates(p, -1)}
                  disabled={plateWeight - p * 2 < cfg.barWeight}
                  style={{
                    backgroundColor: Colors.surface2, borderRadius: 6,
                    paddingVertical: 6, alignItems: 'center',
                    borderWidth: 1, borderColor: Colors.border,
                    opacity: plateWeight - p * 2 < cfg.barWeight ? 0.3 : 1,
                  }}
                >
                  <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700' }}>-{p}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {showRpe && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
          {RPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => { setRpe(opt); setShowRpe(false); }}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                backgroundColor: rpe === opt ? Colors.accent : Colors.surface2,
                borderWidth: 1,
                borderColor: rpe === opt ? Colors.accent : Colors.border,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 13 }}>{opt}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => { setRpe(undefined); setShowRpe(false); }}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note Modal */}
      <Modal visible={noteOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setNoteOpen(false)} />
          <View style={{ backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Set note</Text>
              <TouchableOpacity onPress={() => setNoteOpen(false)}>
                <Text style={{ color: Colors.accent, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              autoFocus
              multiline
              placeholder="Left shoulder felt tight... bar path was off... felt strong..."
              placeholderTextColor={Colors.textMuted}
              style={{
                backgroundColor: Colors.surface2,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: Colors.text,
                fontSize: 15,
                minHeight: 80,
                maxHeight: 160,
                textAlignVertical: 'top',
                lineHeight: 22,
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export function LoggedSetRow({
  set,
  isPR,
  onDelete,
  onEdit,
}: {
  set: LoggedSet;
  isPR?: boolean;
  onDelete?: (localId: string) => void;
  onEdit?: (localId: string, data: { weight: number; reps: number; rpe?: number; note?: string }) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [weight, setWeight] = useState(set.weight.toString());
  const [reps, setReps] = useState(set.reps.toString());
  const [rpe, setRpe] = useState<number | undefined>(set.rpe);
  const [note, setNote] = useState(set.note ?? '');

  const handlePress = () => {
    if (onEdit) setEditOpen(true);
  };

  const handleDelete = () => {
    setEditOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      `Delete Set ${set.setNumber}?`,
      `${set.weight === 0 ? 'BW' : set.weight} × ${set.reps}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(set.localId) },
      ]
    );
  };

  const handleSaveEdit = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || !r) return;
    onEdit?.(set.localId, { weight: w, reps: r, rpe, note: note.trim() || undefined });
    setEditOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={onEdit ? 0.65 : 1}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
          backgroundColor: set.isWarmup ? '#F97316' + '08' : isPR ? Colors.gold + '08' : 'transparent',
          borderLeftWidth: (set.isWarmup || isPR) ? 3 : 0,
          borderLeftColor: set.isWarmup ? '#F97316' : isPR ? Colors.gold : 'transparent',
        }}
      >
        <Text style={{
          color: set.isWarmup ? '#F97316' + 'CC' : isPR ? Colors.gold + 'CC' : Colors.textMuted,
          fontSize: 11, width: 22, textAlign: 'center',
          fontWeight: (set.isWarmup || isPR) ? '900' : '500',
        }}>
          {set.isWarmup ? 'W' : set.setNumber}
        </Text>
        <Text style={{
          color: set.isWarmup ? Colors.textMuted : Colors.text,
          fontSize: 16, fontWeight: '700', flex: 1, letterSpacing: -0.3,
          opacity: set.isWarmup ? 0.7 : 1,
        }}>
          {set.weight === 0 ? 'BW' : set.weight} × {set.reps}
        </Text>
        {set.rpe && (
          <View style={{
            backgroundColor: Colors.surface2,
            borderRadius: 5,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700' }}>
              RPE {set.rpe}
            </Text>
          </View>
        )}
        {isPR && (
          <View style={{
            backgroundColor: Colors.gold + '22',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: Colors.gold + '50',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
          }}>
            <Text style={{ fontSize: 9 }}>🏆</Text>
            <Text style={{ color: Colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>PR</Text>
          </View>
        )}
        {set.note && (
          <Text style={{ color: Colors.textSecondary, fontSize: 11, fontStyle: 'italic', flex: 1 }} numberOfLines={1}>
            "{set.note}"
          </Text>
        )}
        {onEdit && (
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>✏️</Text>
        )}
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal visible={editOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setEditOpen(false)} />
          <View style={{
            backgroundColor: Colors.surface,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            padding: 20,
            gap: 14,
          }}>
            <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>
              Edit Set {set.setNumber}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Weight</Text>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={{
                    backgroundColor: Colors.surface2,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: Colors.text,
                    fontSize: 22,
                    fontWeight: '700',
                    textAlign: 'center',
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Reps</Text>
                <TextInput
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  style={{
                    backgroundColor: Colors.surface2,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: Colors.text,
                    fontSize: 22,
                    fontWeight: '700',
                    textAlign: 'center',
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                />
              </View>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor={Colors.textMuted}
              style={{
                backgroundColor: Colors.surface2,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: Colors.text,
                fontSize: 14,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.text, fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
            {onDelete && (
              <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: Colors.danger, fontSize: 13, fontWeight: '600' }}>Delete Set</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
