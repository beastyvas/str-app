import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscle?: string;
  equipment_type?: string;
}

interface Props {
  visible: boolean;
  alreadyAdded: string[];
  onSelect: (exercise: Exercise & { equipment_type?: string }) => void;
  onClose: () => void;
}

const MUSCLE_GROUPS = [
  'All', 'Chest', 'Shoulders', 'Triceps', 'Biceps',
  'Mid-Upper Back', 'Lats', 'Quads', 'Hamstrings', 'Glutes',
  'Core', 'Calves', 'Forearms', 'Overall',
];

export function ExercisePickerModal({ visible, alreadyAdded, onSelect, onClose }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filtered, setFiltered] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    supabase
      .from('exercises')
      .select('id, name, muscle_group, secondary_muscle, equipment_type')
      .order('muscle_group')
      .order('name')
      .then(({ data }) => {
        setExercises(data ?? []);
        setLoading(false);
      });
  }, [visible]);

  useEffect(() => {
    let list = exercises;
    if (selectedGroup !== 'All') {
      list = list.filter(e => e.muscle_group === selectedGroup);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [exercises, search, selectedGroup]);

  const handleClose = () => {
    setSearch('');
    setSelectedGroup('All');
    onClose();
  };

  const renderItem = useCallback(({ item }: { item: Exercise }) => {
    const isAdded = alreadyAdded.includes(item.id);
    return (
      <TouchableOpacity
        onPress={() => {
          if (!isAdded) {
            onSelect(item);
            handleClose();
          }
        }}
        activeOpacity={isAdded ? 1 : 0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          opacity: isAdded ? 0.4 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>
            {item.name}
          </Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {item.muscle_group}
            {item.secondary_muscle ? ` · ${item.secondary_muscle}` : ''}
            {item.equipment_type ? ` · ${item.equipment_type}` : ''}
          </Text>
        </View>
        {isAdded && (
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Added</Text>
        )}
        {!isAdded && (
          <Text style={{ color: Colors.accent, fontSize: 20, fontWeight: '300' }}>+</Text>
        )}
      </TouchableOpacity>
    );
  }, [alreadyAdded]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          }}>
            <Text style={{ flex: 1, color: Colors.text, fontSize: 18, fontWeight: '800' }}>
              Add Exercise
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: Colors.accent, fontSize: 16, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises..."
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
              style={{
                backgroundColor: Colors.surface2,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: Colors.text,
                fontSize: 15,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            />
          </View>

          {/* Muscle group filter pills */}
          <FlatList
            horizontal
            data={MUSCLE_GROUPS}
            keyExtractor={g => g}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
            renderItem={({ item: group }) => (
              <TouchableOpacity
                onPress={() => setSelectedGroup(group)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: selectedGroup === group ? Colors.accent : Colors.surface2,
                  borderWidth: 1,
                  borderColor: selectedGroup === group ? Colors.accent : Colors.border,
                  flexShrink: 0,
                }}
              >
                <Text style={{
                  color: selectedGroup === group ? Colors.text : Colors.textMuted,
                  fontSize: 12,
                  fontWeight: '700',
                  flexShrink: 0,
                }}>
                  {group}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Exercise list */}
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 14 }}>
                    No exercises found
                  </Text>
                </View>
              )}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
