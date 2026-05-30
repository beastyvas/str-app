import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { LoggedSet } from '@/hooks/useWorkout';

interface SetRowProps {
  set: LoggedSet;
  prevSet?: LoggedSet;       // previous session's set for reference
  isPR?: boolean;
  onLog: (data: { weight: number; reps: number; rpe?: number; note?: string }) => Promise<void>;
  readOnly?: boolean;
}

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

// When readOnly=true, we just display. When false, this is the input row.
export function SetInputRow({
  setNumber,
  prevSet,
  onLog,
}: {
  setNumber: number;
  prevSet?: LoggedSet;
  onLog: (data: { weight: number; reps: number; rpe?: number; note?: string }) => Promise<void>;
}) {
  const [weight, setWeight] = useState(prevSet?.weight?.toString() ?? '');
  const [reps, setReps] = useState(prevSet?.reps?.toString() ?? '');
  const [rpe, setRpe] = useState<number | undefined>(prevSet?.rpe);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showRpe, setShowRpe] = useState(false);

  const noteRef = useRef<TextInput>(null);

  const handleLog = async () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || !r) return;
    setLogging(true);
    try {
      await onLog({ weight: w, reps: r, rpe, note: note.trim() || undefined });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Reset for next set
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
      {/* Main input row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {/* Set number */}
        <Text style={{ color: Colors.textMuted, fontSize: 13, width: 22, textAlign: 'center', fontWeight: '700' }}>
          {setNumber}
        </Text>

        {/* Weight */}
        <View style={{ flex: 1.4 }}>
          {prevSet && (
            <Text style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginBottom: 2 }}>
              {prevSet.weight}
            </Text>
          )}
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            style={inputStyle}
            selectTextOnFocus
          />
        </View>

        <Text style={{ color: Colors.textMuted, fontSize: 18, fontWeight: '300' }}>×</Text>

        {/* Reps */}
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

        {/* RPE chip */}
        <TouchableOpacity
          onPress={() => setShowRpe(!showRpe)}
          style={{
            backgroundColor: rpe ? Colors.accentDim : Colors.surface2,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: rpe ? Colors.accent : Colors.border,
            paddingHorizontal: 8,
            paddingVertical: 10,
            minWidth: 46,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: rpe ? Colors.accent : Colors.textMuted, fontSize: 11, fontWeight: '700' }}>
            {rpe ? `${rpe}` : 'RPE'}
          </Text>
        </TouchableOpacity>

        {/* Note icon */}
        <TouchableOpacity
          onPress={() => setNoteOpen(true)}
          style={{
            backgroundColor: note ? Colors.surface2 : 'transparent',
            borderRadius: 8,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 16, opacity: note ? 1 : 0.4 }}>📝</Text>
        </TouchableOpacity>

        {/* Log button */}
        <TouchableOpacity
          onPress={handleLog}
          disabled={!weight || !reps || logging}
          style={{
            backgroundColor: weight && reps && !logging ? Colors.accent : Colors.surface2,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{
            color: weight && reps && !logging ? Colors.text : Colors.textMuted,
            fontWeight: '800', fontSize: 13,
          }}>
            {logging ? '...' : 'LOG'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* RPE Selector */}
      {showRpe && (
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}>
          {RPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => { setRpe(opt); setShowRpe(false); }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
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
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: Colors.surface2,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note Modal — feels like texting */}
      <Modal visible={noteOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setNoteOpen(false)}
          />
          <View style={{
            backgroundColor: Colors.surface,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            padding: 16,
            gap: 12,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                Set note
              </Text>
              <TouchableOpacity onPress={() => setNoteOpen(false)}>
                <Text style={{ color: Colors.accent, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={noteRef}
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

// Display-only logged set row
export function LoggedSetRow({ set, isPR }: { set: LoggedSet; isPR?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 6,
      gap: 8,
      opacity: 0.85,
    }}>
      <Text style={{ color: Colors.textMuted, fontSize: 12, width: 22, textAlign: 'center' }}>
        {set.setNumber}
      </Text>
      <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
        {set.weight} × {set.reps}
      </Text>
      {set.rpe && (
        <Text style={{ color: Colors.textMuted, fontSize: 12 }}>RPE {set.rpe}</Text>
      )}
      {isPR && (
        <View style={{
          backgroundColor: Colors.goldDim,
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}>
          <Text style={{ color: Colors.gold, fontSize: 10, fontWeight: '800' }}>PR</Text>
        </View>
      )}
      {set.note && (
        <Text style={{ color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', flex: 1 }}>
          "{set.note}"
        </Text>
      )}
    </View>
  );
}
