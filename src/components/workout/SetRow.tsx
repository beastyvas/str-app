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
  onLog: (data: { weight: number; reps: number; rpe?: number; note?: string }) => Promise<void>;
}) {
  const defaultMode = prevSet?.weight === 0
    ? 'bw'
    : defaultModeForEquipment(equipmentType);

  const [mode, setMode] = useState<WeightMode>(defaultMode);
  const [plateSystem, setPlateSystem] = useState<PlateSystem>('lbs');
  // Default to EMPTY — user types their own weight, previous shown as hint only
  const [weight, setWeight] = useState(
    defaultMode === 'bw' ? '' :
    defaultMode === 'plates' ? String(PLATE_CONFIGS.lbs.barWeight) :
    ''  // always start empty, prev shown as placeholder hint
  );
  const [reps, setReps] = useState('');  // always start empty
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const [showExtras, setShowExtras] = useState(false);

  const cfg = PLATE_CONFIGS[plateSystem];
  const plateWeight = parseFloat(weight) || cfg.barWeight;

  const adjustPlates = (plateSize: number, direction: 1 | -1) => {
    const delta = plateSize * 2 * direction; // both sides
    const next = Math.max(cfg.barWeight, plateWeight + delta);
    setWeight(String(Math.round(next * 10) / 10));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cycleMode = () => {
    setMode(prev => {
      if (prev === 'number') return 'bw';
      if (prev === 'bw') return 'plates';
      return 'number';
    });
    setWeight(mode === 'bw' ? '' : mode === 'plates' ? String(cfg.barWeight) : '');
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
      await onLog({ weight: w, reps: r, rpe, note: note.trim() || undefined });
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

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ color: Colors.textMuted, fontSize: 13, width: 22, textAlign: 'center', fontWeight: '700' }}>
          {setNumber}
        </Text>

        {/* Weight — switches by mode */}
        <View style={{ flex: 1.6 }}>
          {prevSet && (
            <Text style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginBottom: 2 }}>
              {prevSet.weight === 0 ? 'BW' : prevSet.weight}
            </Text>
          )}
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
          {prevSet && (
            <Text style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginBottom: 2 }}>
              {prevSet.reps}
            </Text>
          )}
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
            backgroundColor: mode !== 'number' ? Colors.accentDim : 'transparent',
            borderRadius: 5, paddingHorizontal: 4, paddingVertical: 6,
            borderWidth: mode !== 'number' ? 1 : 0,
            borderColor: Colors.accent + '60',
          }}
        >
          <Text style={{ color: mode !== 'number' ? Colors.accent : Colors.textMuted, fontSize: 8, fontWeight: '900' }}>
            {mode === 'number' ? '⚖' : mode === 'bw' ? 'BW' : 'PLT'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLog}
          disabled={!canLog() || logging}
          style={{
            backgroundColor: canLog() && !logging ? Colors.accent : Colors.surface2,
            borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
          }}
        >
          <Text style={{ color: canLog() && !logging ? Colors.text : Colors.textMuted, fontWeight: '800', fontSize: 13 }}>
            {logging ? '...' : 'LOG'}
          </Text>
        </TouchableOpacity>
      </View>

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

  const handleLongPress = () => {
    if (!onDelete && !onEdit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      `Set ${set.setNumber}`,
      `${set.weight} × ${set.reps}`,
      [
        { text: 'Edit', onPress: () => setEditOpen(true) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(set.localId),
        },
        { text: 'Cancel', style: 'cancel' },
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
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 8,
        }}
      >
        <Text style={{ color: Colors.textMuted, fontSize: 12, width: 22, textAlign: 'center' }}>
          {set.setNumber}
        </Text>
        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
          {set.weight === 0 ? 'BW' : set.weight} × {set.reps}
        </Text>
        {set.rpe && (
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>RPE {set.rpe}</Text>
        )}
        {isPR && (
          <View style={{ backgroundColor: Colors.goldDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: Colors.gold, fontSize: 10, fontWeight: '800' }}>PR</Text>
          </View>
        )}
        {set.note && (
          <Text style={{ color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', flex: 1 }} numberOfLines={1}>
            "{set.note}"
          </Text>
        )}
        {(onDelete || onEdit) && (
          <Text style={{ color: Colors.border, fontSize: 10 }}>···</Text>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
