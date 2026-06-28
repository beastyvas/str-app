import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAgree?: () => void; // when present, shows an "I Agree" button (acceptance flow)
}

// Terms of Use (EULA). Apple Guideline 1.2 requires UGC apps to present terms
// with a zero-tolerance policy for objectionable content/abusive users, accepted
// before account creation.
export function EulaModal({ visible, onClose, onAgree }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        }}>
          <Text style={{ color: Colors.text, fontSize: 18, fontWeight: '900' }}>Terms of Use</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 22 }}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
            Last updated: 2026. By creating an account or using STR, you agree to these Terms.
          </Text>

          <Section title="1. Acceptance">
            By tapping “I Agree” and using STR, you accept these Terms of Use and our Privacy
            Policy. You must be at least 13 years old to use STR.
          </Section>

          <Section title="2. Zero Tolerance for Objectionable Content & Abuse">
            STR has a strict <Bold>zero-tolerance policy</Bold> for objectionable, hateful,
            harassing, threatening, sexually explicit, or otherwise abusive content, and for
            abusive behavior toward other users. This applies to display names, profiles,
            workout notes, comments, and any other content you submit or share.
            {'\n\n'}
            You agree that you will not post objectionable content or harass, bully, or abuse
            other users. Content that violates this policy and users who engage in abusive
            behavior may be removed or banned without notice.
          </Section>

          <Section title="3. Reporting & Blocking">
            STR provides tools to <Bold>report</Bold> objectionable content and to{' '}
            <Bold>block</Bold> abusive users. Reports are reviewed and appropriate action —
            including content removal and account termination — will be taken, typically within
            24 hours. Blocking a user immediately hides their content from you.
          </Section>

          <Section title="4. Your Responsibilities">
            You are responsible for the content you submit and for your conduct. You retain
            ownership of your content but grant STR a license to display it within the app to
            you and the friends you choose to share with.
          </Section>

          <Section title="5. Enforcement">
            We may remove content, suspend, or permanently terminate accounts that violate these
            Terms, at our sole discretion, to keep the community safe.
          </Section>

          <Section title="6. Disclaimer">
            STR provides training information and AI-generated coaching for general informational
            purposes only and is not medical advice. Consult a professional before beginning any
            exercise program. Train at your own risk.
          </Section>

          {onAgree && (
            <TouchableOpacity
              onPress={onAgree}
              style={{
                backgroundColor: Colors.accent, borderRadius: 14,
                paddingVertical: 16, alignItems: 'center', marginTop: 8,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: '900', fontSize: 16 }}>I Agree</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: Colors.text, fontWeight: '800' }}>{children}</Text>;
}
