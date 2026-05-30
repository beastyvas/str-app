import { useState } from 'react';
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
  onDeleteSet: (exerciseId: string, localId: string) => void;
  onEditSet: (exerciseId: string, localId: string, data: { weight: number; reps: number; rpe?: number; note?: string }) => void;
  onNavigateToDetail: (exerciseId: string) => void;
}

export function ExerciseCard({
  exercise,
  prevSets = [],
  prMap = {},
  workoutId,
  userId,
  onLogSet,
  onRemove,
  onDeleteSet,
  onEditSet,
  onNavigateToDetail,
}: ExerciseCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const nextSetNumber = exercise.sets.length + 1;
  const prevSetForNext = prevSets[exercise.sets.length]; // mirror index

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
      borderRadius: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>
            {exercise.exerciseName}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {exercise.muscleGroup}
            {exercise.sets.length > 0 ? ` · ${exercise.sets.length} set${exercise.sets.length !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>

        {/* Info button */}
        <TouchableOpacity
          onPress={() => onNavigateToDetail(exercise.exerciseId)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: Colors.surface2,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700' }}>i</Text>
        </TouchableOpacity>

        {/* Remove */}
        <TouchableOpacity
          onPress={handleRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: Colors.surface2,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 16, lineHeight: 20 }}>×</Text>
        </TouchableOpacity>

        {/* Collapse chevron */}
        <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
          {collapsed ? '▼' : '▲'}
        </Text>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {/* Column headers */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingBottom: 6,
            gap: 8,
          }}>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, width: 22, textAlign: 'center' }}>
              SET
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, flex: 1.4, textAlign: 'center' }}>
              WEIGHT
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, width: 14 }} />
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, flex: 1, textAlign: 'center' }}>
              REPS
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, width: 46 }} />
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, width: 32 }} />
            <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1, width: 46 }} />
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
            <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 16, marginVertical: 4 }} />
          )}

          {/* Input row for next set */}
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
}
