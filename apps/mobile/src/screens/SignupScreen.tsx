import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../shared/components/Button';
import { Input } from '../shared/components/Input';
import { authService } from '../shared/services/auth';
import { useAuth } from '../navigation/AuthContext';
import { NavigationProp } from '../shared/types';

interface SignupScreenProps {
  navigation: NavigationProp;
}

export function SignupScreen({ navigation }: SignupScreenProps) {
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const [principalData, setPrincipalData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    school_name: '',
    school_address: '',
    school_registration_number: '',
    contact_phone: '',
    contact_email: '',
  });

  const handlePrincipalSignup = async () => {
    if (
      !principalData.email ||
      !principalData.password ||
      !principalData.full_name ||
      !principalData.phone ||
      !principalData.school_name ||
      !principalData.school_registration_number
    ) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.signupPrincipal(principalData);
      setUser(response.user);
    } catch {
      Alert.alert('Signup Failed', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create your school</Text>
          <Text style={styles.subtitle}>Principal signup — set up your school account</Text>
        </View>

        <View style={styles.studentNotice}>
          <Text style={styles.studentNoticeTitle}>Students</Text>
          <Text style={styles.studentNoticeBody}>Contact your school to get login credentials.</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="Your full name"
            value={principalData.full_name}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, full_name: text })}
          />
          <Input
            label="Email"
            placeholder="your@email.com"
            value={principalData.email}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            placeholder="Minimum 8 characters"
            value={principalData.password}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, password: text })}
            secureTextEntry
          />
          <Input
            label="Phone"
            placeholder="Your phone number"
            value={principalData.phone}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, phone: text })}
            keyboardType="phone-pad"
          />
          <Input
            label="School Name"
            placeholder="Your school name"
            value={principalData.school_name}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, school_name: text })}
          />
          <Input
            label="School Registration Number"
            placeholder="Unique registration number"
            value={principalData.school_registration_number}
            onChangeText={(text: string) =>
              setPrincipalData({ ...principalData, school_registration_number: text })
            }
          />
          <Input
            label="School Address (Optional)"
            placeholder="School address"
            value={principalData.school_address}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, school_address: text })}
          />
          <Input
            label="Contact Phone (Optional)"
            placeholder="School phone"
            value={principalData.contact_phone}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, contact_phone: text })}
            keyboardType="phone-pad"
          />
          <Input
            label="Contact Email (Optional)"
            placeholder="school@email.com"
            value={principalData.contact_email}
            onChangeText={(text: string) => setPrincipalData({ ...principalData, contact_email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Button
            title="Create School"
            onPress={handlePrincipalSignup}
            loading={loading}
            disabled={loading}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
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
  studentNotice: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  studentNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 6,
  },
  studentNoticeBody: {
    fontSize: 14,
    color: '#1e3a8a',
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
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
