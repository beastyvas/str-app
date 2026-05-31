import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, ScrollView,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
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

// Most commonly used per group — shown first
const FEATURED: Record<string, string[]> = {
  'Chest':        ['Barbell Bench Press', 'Incline Barbell Bench Press', 'Dumbbell Bench Press', 'Dips', 'Pec Deck Cable Flys', 'Cable Crossover'],
  'Shoulders':    ['Overhead Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Arnold Press', 'Face Pulls', 'Rear Delt Fly'],
  'Triceps':      ['Close Grip Bench Press', 'Skull Crushers', 'Rope Pushdown', 'Overhand Pushdowns', 'Katana Extensions', 'JM Press'],
  'Biceps':       ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'EZ Bar Curl', 'Cable Curl', 'Incline Curl'],
  'Mid-Upper Back':['Barbell Row', 'Pullups', 'Lat Pulldowns', 'Seated Cable Row', 'T-Bar Row', 'Face Pulls'],
  'Lats':         ['Lat Pulldowns', 'Pullups', 'Lat Pullover', 'Straight Arm Pulldown'],
  'Quads':        ['Barbell Back Squats', 'Hack Squats', 'Leg Press', 'Leg Extensions', 'Bulgarian Split Squat'],
  'Hamstrings':   ['Barbell RDLs', 'Leg Curl', 'Nordic Hamstring Curl', 'Good Mornings', 'Dumbbell RDLs'],
  'Glutes':       ['Hip Thrust', 'KAS Glute Bridge', 'Glute Focused Back Extension'],
  'Overall':      ['Deadlifts', 'Power Clean', 'Trap Bar Deadlift', 'Rack Pull'],
  'Core':         ['Ab Wheel Rollout', 'Hanging Leg Raise', 'Pallof Press', 'Cable Crunch', 'Dead Bug'],
  'Calves':       ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise'],
};

const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbells', 'Cable Machine', 'Machine', 'Bodyweight', 'Kettlebell', 'Resistance Band', 'Other'];

export function ExercisePickerModal({ visible, alreadyAdded, onSelect, onClose }: Props) {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filtered, setFiltered] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [loading, setLoading] = useState(true);

  // Create exercise state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [newEquipment, setNewEquipment] = useState('Barbell');
  const [creating, setCreating] = useState(false);

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

    // Sort: featured first, then alphabetical
    const featuredList = selectedGroup !== 'All' ? (FEATURED[selectedGroup] ?? []) : [];
    const sorted = [...list].sort((a, b) => {
      const ai = featuredList.findIndex(f => f.toLowerCase() === a.name.toLowerCase());
      const bi = featuredList.findIndex(f => f.toLowerCase() === b.name.toLowerCase());
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    setFiltered(sorted);
  }, [exercises, search, selectedGroup]);

  const handleClose = () => {
    setSearch('');
    setSelectedGroup('All');
    setShowCreate(false);
    onClose();
  };

  const handleCreateExercise = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: newName.trim(),
          muscle_group: newGroup,
          equipment_type: newEquipment,
          is_custom: true,
          created_by: user.id,
          form_cues: null,
        })
        .select()
        .single();

      if (error) throw error;
      // Add to local list and select it
      setExercises(prev => [...prev, data]);
      onSelect(data);
      setShowCreate(false);
      setNewName('');
      handleClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const renderItem = useCallback(({ item, index }: { item: Exercise; index: number }) => {
    const isAdded = alreadyAdded.includes(item.id);
    const featuredList = selectedGroup !== 'All' ? (FEATURED[selectedGroup] ?? []) : [];
    const isFeatured = featuredList.some(f => f.toLowerCase() === item.name.toLowerCase());

    return (
      <TouchableOpacity
        onPress={() => { if (!isAdded) { onSelect(item); handleClose(); } }}
        activeOpacity={isAdded ? 1 : 0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          opacity: isAdded ? 0.4 : 1,
          backgroundColor: isFeatured && !search.trim() ? Colors.accent + '06' : 'transparent',
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>
              {item.name}
            </Text>
            {isFeatured && !search.trim() && (
              <View style={{
                backgroundColor: Colors.accent + '20',
                borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
              }}>
                <Text style={{ color: Colors.accent, fontSize: 9, fontWeight: '800' }}>POPULAR</Text>
              </View>
            )}
          </View>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {item.muscle_group}
            {item.secondary_muscle ? ` · ${item.secondary_muscle}` : ''}
            {item.equipment_type ? ` · ${item.equipment_type}` : ''}
          </Text>
        </View>
        {isAdded ? (
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Added</Text>
        ) : (
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: Colors.accentDim,
            borderWidth: 1, borderColor: Colors.accent + '40',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: Colors.accent, fontSize: 18, lineHeight: 20, fontWeight: '300' }}>+</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [alreadyAdded, selectedGroup, search]);

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
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              style={{
                backgroundColor: Colors.accentDim,
                borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
                borderWidth: 1, borderColor: Colors.accent + '40',
                marginRight: 12,
              }}
            >
              <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 13 }}>+ Create</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: Colors.surface2,
                borderWidth: 1, borderColor: Colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
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

          {/* Muscle group filter — ScrollView instead of FlatList for reliable pill display */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 10,
            }}
          >
            {MUSCLE_GROUPS.map((group, i) => (
              <TouchableOpacity
                key={group}
                onPress={() => setSelectedGroup(group)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: selectedGroup === group ? Colors.accent : Colors.surface2,
                  borderWidth: 1,
                  borderColor: selectedGroup === group ? Colors.accent : Colors.border,
                  marginRight: i < MUSCLE_GROUPS.length - 1 ? 8 : 0,
                  flexShrink: 0,
                  flexGrow: 0,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: selectedGroup === group ? Colors.text : Colors.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {group}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
                <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 14 }}>
                    No exercises found
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setNewName(search); setShowCreate(true); }}
                    style={{
                      backgroundColor: Colors.accentDim,
                      borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
                      borderWidth: 1, borderColor: Colors.accent + '40',
                    }}
                  >
                    <Text style={{ color: Colors.accent, fontWeight: '700' }}>
                      + Create "{search}"
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </KeyboardAvoidingView>

        {/* Create Exercise Modal */}
        <Modal visible={showCreate} transparent animationType="slide">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
              activeOpacity={1}
              onPress={() => setShowCreate(false)}
            />
            <View style={{
              backgroundColor: Colors.surface,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: 24, borderTopWidth: 1, borderTopColor: Colors.border,
              gap: 16,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Create Exercise</Text>
                <TouchableOpacity
                  onPress={() => setShowCreate(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: Colors.textMuted, fontSize: 18 }}>×</Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Exercise Name</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  placeholder="e.g. Cable Pullthrough"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.surface2, borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 14,
                    color: Colors.text, fontSize: 16,
                    borderWidth: 1, borderColor: Colors.border,
                  }}
                />
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Muscle Group</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {MUSCLE_GROUPS.filter(g => g !== 'All').map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setNewGroup(g)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                        backgroundColor: newGroup === g ? Colors.accent : Colors.surface2,
                        borderWidth: 1, borderColor: newGroup === g ? Colors.accent : Colors.border,
                      }}
                    >
                      <Text style={{ color: newGroup === g ? Colors.text : Colors.textMuted, fontSize: 12, fontWeight: '700' }}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={{ color: Colors.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Equipment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EQUIPMENT_OPTIONS.map(eq => (
                    <TouchableOpacity
                      key={eq}
                      onPress={() => setNewEquipment(eq)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                        backgroundColor: newEquipment === eq ? Colors.accent : Colors.surface2,
                        borderWidth: 1, borderColor: newEquipment === eq ? Colors.accent : Colors.border,
                      }}
                    >
                      <Text style={{ color: newEquipment === eq ? Colors.text : Colors.textMuted, fontSize: 12, fontWeight: '700' }}>{eq}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                onPress={handleCreateExercise}
                disabled={!newName.trim() || creating}
                style={{
                  backgroundColor: newName.trim() && !creating ? Colors.accent : Colors.surface2,
                  borderRadius: 14, paddingVertical: 16, alignItems: 'center',
                }}
              >
                {creating
                  ? <ActivityIndicator color={Colors.text} />
                  : <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 15 }}>Create & Add</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
