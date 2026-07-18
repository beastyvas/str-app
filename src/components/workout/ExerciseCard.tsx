import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '@/constants/colors';
import { WorkoutExercise, LoggedSet } from '@/hooks/useWorkout';
import { SetInputRow, LoggedSetRow } from './SetRow';

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  prevSets?: LoggedSet[];
  prMap?: Record<string, boolean>;
  workoutId: string;
  userId: string;
  onLogSet: (
    exerciseId: string,
    data: { weight: number; reps: number; rpe?: number; note?: string }
  ) => Promise<{ isPR: boolean }>;
  onRemove: (exerciseId: string) => void;
  onReplace: (exerciseId: string) => void;
  onDeleteSet: (exerciseId: string, localId: string) => void;
  onEditSet: (exerciseId: string, localId: string, data: { weight: number; reps: number; rpe?: number; note?: string }) => void;
  onNavigateToDetail: (exerciseId: string) => void;
  // Superset pairing: 'first' | 'second' when this card is half of a pair
  supersetRole?: 'first' | 'second' | null;
  // Show the link button when pairing with the next card is possible (or to unlink)
  canToggleSuperset?: boolean;
  onToggleSuperset?: (exerciseId: string) => void;
}

const MUSCLE_COLORS: Record<string, string> = {
  'Chest': '#C2566B',
  'Shoulders': '#9B59B6',
  'Triceps': '#8E44AD',
  'Biceps': '#3498DB',
  'Mid-Upper Back': '#1ABC9C',
  'Lats': '#16A085',
  'Quads': '#E67E22',
  'Hamstrings': '#D35400',
  'Glutes': '#E74C3C',
  'Core': '#F39C12',
  'Calves': '#95A5A6',
  'Forearms': '#7F8C8D',
  'Overall': '#ECF0F1',
};

// memo: the workout screen re-renders on every store change (any set logged
// anywhere); each card only cares about its own exercise slice + callbacks.
export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  prevSets = [],
  prMap = {},
  workoutId,
  userId,
  onLogSet,
  onRemove,
  onReplace,
  onDeleteSet,
  onEditSet,
  supersetRole = null,
  canToggleSuperset = false,
  onToggleSuperset,
  onNavigateToDetail,
}: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const nextSetNumber = exercise.sets.length + 1;
  const prevSetForNext = prevSets[exercise.sets.length];
  const accentColor = MUSCLE_COLORS[exercise.muscleGroup] ?? Colors.accent;

  const handleRemove = () => {
    Alert.alert(
      'Remove Exercise',
      `Remove ${exercise.exerciseName} from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove(exercise.exerciseId) },
      ]
    );
  };

  return (
    <View style={{
      backgroundColor: Colors.surface,
      borderRadius: 18,
      marginHorizontal: 14,
      // Paired cards sit tight together so the superset reads as one block
      marginBottom: supersetRole === 'first' ? 4 : 14,
      overflow: 'hidden',
      // Elevation instead of a 1px outline — the accent strip carries the color
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    }}>
      {/* Muscle group accent strip */}
      <View style={{ height: 3, backgroundColor: accentColor, opacity: 0.7 }} />

      {/* Header */}
      <TouchableOpacity
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.75}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 12,
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{
            color: Colors.text,
            fontSize: 16,
            fontWeight: '800',
            letterSpacing: -0.4,
          }}>
            {exercise.exerciseName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: accentColor,
            }} />
            <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
              {exercise.muscleGroup}
              {exercise.sets.length > 0
                ? ` · ${exercise.sets.length} set${exercise.sets.length !== 1 ? 's' : ''}`
                : ''}
            </Text>
            {supersetRole && (
              <View style={{
                backgroundColor: Colors.accentDim, borderRadius: 4,
                paddingHorizontal: 5, paddingVertical: 1,
              }}>
                <Text style={{ color: Colors.accent, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }}>
                  SUPERSET {supersetRole === 'first' ? 'A' : 'B'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Superset link — pair with the next exercise, alternate sets */}
        {canToggleSuperset && (
          <TouchableOpacity
            onPress={() => onToggleSuperset?.(exercise.exerciseId)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: supersetRole ? Colors.accentDim : Colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: supersetRole ? Colors.accent : Colors.textMuted, fontSize: 13, fontWeight: '800' }}>⛓</Text>
          </TouchableOpacity>
        )}

        {/* Info button */}
        <TouchableOpacity
          onPress={() => onNavigateToDetail(exercise.exerciseId)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: Colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '800' }}>i</Text>
        </TouchableOpacity>

        {/* Replace */}
        <TouchableOpacity
          onPress={() => onReplace(exercise.exerciseId)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: Colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '800' }}>⇄</Text>
        </TouchableOpacity>

        {/* Remove */}
        <TouchableOpacity
          onPress={handleRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: Colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 18, lineHeight: 22 }}>×</Text>
        </TouchableOpacity>

        {/* Collapse chevron */}
        <View style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: collapsed ? Colors.surface2 : Colors.accentDim,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{
            color: collapsed ? Colors.textMuted : Colors.accent,
            fontSize: 9,
            fontWeight: '800',
          }}>
            {collapsed ? '▼' : '▲'}
          </Text>
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {/* Column headers */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingBottom: 8,
            gap: 8,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, width: 22, textAlign: 'center', fontWeight: '700' }}>
              SET
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, flex: 1.4, textAlign: 'center', fontWeight: '700' }}>
              WEIGHT
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, width: 14 }} />
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, flex: 1, textAlign: 'center', fontWeight: '700' }}>
              REPS
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, width: 46 }} />
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, width: 32 }} />
            <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, width: 50 }} />
          </View>

          {/* Logged sets */}
          {exercise.sets.map(s => (
            <LoggedSetRow
              key={s.localId}
              set={s}
              isPR={prMap[s.localId]}
              onDelete={(localId) => onDeleteSet(exercise.exerciseId, localId)}
              onEdit={(localId, data) => onEditSet(exercise.exerciseId, localId, data)}
            />
          ))}

          {/* Divider before input row */}
          {exercise.sets.length > 0 && (
            <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 14, marginTop: 4 }} />
          )}

          {/* Input row for the next set — always open. Logging keeps the row
              (weight/reps carry over) so the next set is zero extra taps. */}
          <SetInputRow
            setNumber={nextSetNumber}
            prevSet={prevSetForNext}
            equipmentType={exercise.equipmentType}
            onLog={(data) => onLogSet(exercise.exerciseId, data)}
          />
        </>
      )}
    </View>
  );
});
