import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { authService } from '../services/auth';
import { useAuth } from '../navigation/AuthContext';

export function SignupScreen({ navigation }: any) {
  const [step, setStep] = useState<'type' | 'principal' | 'join'>('type');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  // Principal signup fields
  const [principalData, setPrincipalData] = useState({
    email: '',
    password: '',
    full_name: '',
    school_name: '',
    school_address: '',
    contact_phone: '',
    contact_email: '',
  });

  // Join signup fields
  const [joinData, setJoinData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student' as 'clerk' | 'teacher' | 'student' | 'parent',
    join_code: '',
    roll_number: '',
  });

  const handlePrincipalSignup = async () => {
    if (!principalData.email || !principalData.password || !principalData.full_name || !principalData.school_name) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.signupPrincipal(principalData);
      setUser(response.user);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSignup = async () => {
    if (!joinData.email || !joinData.password || !joinData.full_name || !joinData.join_code) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.signupJoin(joinData);
      setUser(response.user);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Failed to join school');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'type') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Choose your signup type</Text>
          </View>

          <View style={styles.options}>
            <Button
              title="Create New School (Principal)"
              onPress={() => setStep('principal')}
              variant="primary"
            />
            <Button
              title="Join Existing School"
              onPress={() => setStep('join')}
              variant="outline"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
              Sign in
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'principal') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Create School</Text>
            <Text style={styles.subtitle}>Set up your school account</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Your full name"
              value={principalData.full_name}
              onChangeText={(text) => setPrincipalData({ ...principalData, full_name: text })}
            />
            <Input
              label="Email"
              placeholder="your@email.com"
              value={principalData.email}
              onChangeText={(text) => setPrincipalData({ ...principalData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Password"
              placeholder="Minimum 8 characters"
              value={principalData.password}
              onChangeText={(text) => setPrincipalData({ ...principalData, password: text })}
              secureTextEntry
            />
            <Input
              label="School Name"
              placeholder="Your school name"
              value={principalData.school_name}
              onChangeText={(text) => setPrincipalData({ ...principalData, school_name: text })}
            />
            <Input
              label="School Address (Optional)"
              placeholder="School address"
              value={principalData.school_address}
              onChangeText={(text) => setPrincipalData({ ...principalData, school_address: text })}
            />
            <Input
              label="Contact Phone (Optional)"
              placeholder="School phone"
              value={principalData.contact_phone}
              onChangeText={(text) => setPrincipalData({ ...principalData, contact_phone: text })}
              keyboardType="phone-pad"
            />

            <Button
              title="Create School"
              onPress={handlePrincipalSignup}
              loading={loading}
              disabled={loading}
            />

            <Button
              title="Back"
              onPress={() => setStep('type')}
              variant="outline"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Join School</Text>
          <Text style={styles.subtitle}>Enter your join code</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="Your full name"
            value={joinData.full_name}
            onChangeText={(text) => setJoinData({ ...joinData, full_name: text })}
          />
          <Input
            label="Email"
            placeholder="your@email.com"
            value={joinData.email}
            onChangeText={(text) => setJoinData({ ...joinData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            placeholder="Minimum 8 characters"
            value={joinData.password}
            onChangeText={(text) => setJoinData({ ...joinData, password: text })}
            secureTextEntry
          />
          <Input
            label="Join Code"
            placeholder="School join code"
            value={joinData.join_code}
            onChangeText={(text) => setJoinData({ ...joinData, join_code: text })}
            autoCapitalize="characters"
          />
          {joinData.role === 'student' && (
            <Input
              label="Roll Number (Optional)"
              placeholder="Student roll number"
              value={joinData.roll_number}
              onChangeText={(text) => setJoinData({ ...joinData, roll_number: text })}
            />
          )}

          <Button
            title="Join School"
            onPress={handleJoinSignup}
            loading={loading}
            disabled={loading}
          />

          <Button
            title="Back"
            onPress={() => setStep('type')}
            variant="outline"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  form: {
    width: '100%',
  },
  options: {
    gap: 16,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
  },
  link: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
});

