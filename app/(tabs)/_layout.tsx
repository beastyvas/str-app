import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, onColor } from '@/constants/theme';
import { useWorld } from '@/theme';

const BTN = 56;
const CUT = 14;

/** Raised center button: a clipped-corner manga panel filled with the aura. */
function WorkoutTabIcon({ focused }: { focused: boolean }) {
  const world = useWorld();
  const fill = focused ? world.aura : Colors.surface2;
  const points = `1,1 ${BTN - CUT},1 ${BTN - 1},${CUT} ${BTN - 1},${BTN - 1} 1,${BTN - 1}`;
  return (
    <View style={styles.btn}>
      <Svg width={BTN} height={BTN} style={StyleSheet.absoluteFill}>
        <Polygon points={points} fill={fill} stroke={world.aura} strokeWidth={2} />
      </Svg>
      <Ionicons name="barbell" size={26} color={focused ? onColor(world.aura) : Colors.text} />
    </View>
  );
}

export default function TabLayout() {
  const world = useWorld();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.bar, { borderTopColor: world.aura + '66' }],
        tabBarActiveTintColor: world.aura,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarAccessibilityLabel: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarAccessibilityLabel: 'Workout',
          tabBarIcon: ({ focused }) => <WorkoutTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Social',
          tabBarAccessibilityLabel: 'Social',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Coach',
          tabBarAccessibilityLabel: 'Coach',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
  },
  btn: {
    width: BTN,
    height: BTN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
});
