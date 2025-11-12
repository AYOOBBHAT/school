import React from 'react';
import { SafeAreaView, Text, View, Pressable } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL as string, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string);

function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{title}</Text>
        <View style={{ height: 12 }} />
        {children}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  void supabase;
  const [role, setRole] = React.useState<'principal'|'clerk'|'teacher'|'student'|'parent'|'none'>('none');
  return (
    <Screen title="School SaaS Mobile">
      {role === 'none' && (
        <View>
          <Text>Select Role (demo)</Text>
          {(['principal','clerk','teacher','student','parent'] as const).map(r => (
            <Pressable key={r} onPress={() => setRole(r)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: '#2563eb' }}>{r}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {role === 'clerk' && <Text>Clerk: collect fees, pending payments, upload report cards</Text>}
      {role === 'principal' && <Text>Principal: manage users, classes</Text>}
      {role === 'teacher' && <Text>Teacher: attendance and marks</Text>}
      {role === 'student' && <Text>Student: timetable, marks, fees</Text>}
      {role === 'parent' && <Text>Parent: child progress, payments</Text>}
    </Screen>
  );
}


