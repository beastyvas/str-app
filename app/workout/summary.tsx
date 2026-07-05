import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

export default function WorkoutSummaryScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();

  let summary = null;
  try { summary = data ? JSON.parse(data) : null; } catch {}

  if (!summary) {
    router.replace('/(tabs)');
    return null;
  }

  const { name, duration, totalSets, totalVolume, prs, exercises } = summary;
  const hasPRs = prs?.length > 0;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const prAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasPRs) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Animated.stagger(120, [
      Animated.spring(headerAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.spring(statsAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.spring(prAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.spring(listAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const slideUp = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[slideUp(headerAnim), { marginBottom: 32 }]}>
          <Text style={{
            color: Colors.accent,
            fontSize: 11,
            letterSpacing: 3,
            textTransform: 'uppercase',
            fontWeight: '700',
            marginBottom: 8,
          }}>
            {hasPRs ? '🔥 Session complete' : 'Session complete'}
          </Text>
          <Text style={{
            color: Colors.text,
            fontSize: 30,
            fontWeight: '800',
            letterSpacing: -1.5,
            lineHeight: 34,
          }}>
            {name}
          </Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[slideUp(statsAnim), { flexDirection: 'row', gap: 12, marginBottom: 24 }]}>
          {[
            { label: 'Duration', value: formatDuration(duration) },
            { label: 'Sets', value: String(totalSets) },
            { label: 'Volume', value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(totalVolume) },
          ].map((stat, i) => (
            <View key={i} style={{
              flex: 1,
              backgroundColor: Colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: 'center',
            }}>
              <Text style={{
                color: Colors.textMuted,
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                fontWeight: '700',
                marginBottom: 8,
              }}>
                {stat.label}
              </Text>
              <Text style={{
                color: Colors.text,
                fontSize: 22,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}>
                {stat.value}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* PRs */}
        {hasPRs && (
          <Animated.View style={[slideUp(prAnim), {
            backgroundColor: Colors.gold + '12',
            borderRadius: 18,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1.5,
            borderColor: Colors.gold + '45',
            shadowColor: Colors.gold,
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Text style={{ fontSize: 22 }}>🏆</Text>
              <Text style={{
                color: Colors.gold,
                fontSize: 13,
                fontWeight: '800',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}>
                New Personal Records
              </Text>
            </View>
            {prs.map((pr: any, i: number) => (
              <View key={i} style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: Colors.gold + '25',
                gap: 10,
              }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.gold,
                  shadowColor: Colors.gold,
                  shadowOpacity: 0.6,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                }} />
                <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                  {pr.exerciseName}
                </Text>
                <Text style={{ color: Colors.gold, fontSize: 15, fontWeight: '800' }}>
                  {pr.weight} × {pr.reps}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Exercise Summary */}
        <Animated.View style={[slideUp(listAnim), {
          backgroundColor: Colors.surface,
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: Colors.border,
          marginBottom: 28,
        }]}>
          <Text style={{
            color: Colors.textMuted,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontWeight: '700',
            marginBottom: 14,
          }}>
            Exercises
          </Text>
          {exercises?.map((ex: any, i: number) => (
            <View key={i} style={{
              paddingVertical: 12,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: Colors.border,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{
                  color: Colors.text,
                  fontSize: 14,
                  fontWeight: '800',
                  flex: 1,
                  marginRight: 8,
                  letterSpacing: -0.2,
                }}>
                  {ex.name}
                </Text>
                <View style={{
                  backgroundColor: Colors.surface2,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    {ex.sets.length} sets
                  </Text>
                </View>
              </View>
              {ex.sets[0] && (
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  Top set: {ex.sets[0].weight === 0 ? 'BW' : ex.sets[0].weight} × {ex.sets[0].reps}
                </Text>
              )}
            </View>
          ))}
        </Animated.View>

        {/* Done button */}
        <Animated.View style={slideUp(listAnim)}>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.88}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: 'center',
              shadowColor: Colors.accent,
              shadowOpacity: 0.4,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Text style={{
              color: Colors.text,
              fontWeight: '800',
              fontSize: 16,
              letterSpacing: 1,
            }}>
              DONE
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
