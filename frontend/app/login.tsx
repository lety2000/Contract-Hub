import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, register } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  const isDesktop = width >= 768;
  const formMaxWidth = isDesktop ? 440 : '100%';

  const handleSubmit = async () => {
    if (!username || !password) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }

    if (password.length < 4) {
      Alert.alert('Fehler', 'Passwort muss mindestens 4 Zeichen haben');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, email || undefined);
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formWrapper, { maxWidth: formMaxWidth }]}>
          <View style={styles.header}>
            <View style={[styles.logoContainer, isDesktop && styles.logoContainerDesktop]}>
              <Ionicons name="document-text" size={isDesktop ? 80 : 64} color="#3b82f6" />
            </View>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Vertragsmanager</Text>
            <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
              Alle Verträge im Überblick
            </Text>
          </View>

          <View style={[styles.form, isDesktop && styles.formDesktop]}>
            <View style={[styles.inputContainer, isDesktop && styles.inputContainerDesktop]}>
              <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDesktop && styles.inputDesktop]}
                placeholder="Benutzername"
                placeholderTextColor="#64748b"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            {!isLogin && (
              <View style={[styles.inputContainer, isDesktop && styles.inputContainerDesktop]}>
                <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isDesktop && styles.inputDesktop]}
                  placeholder="E-Mail (optional)"
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            )}

            <View style={[styles.inputContainer, isDesktop && styles.inputContainerDesktop]}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDesktop && styles.inputDesktop]}
                placeholder="Passwort"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                isDesktop && styles.buttonDesktop,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.buttonText, isDesktop && styles.buttonTextDesktop]}>
                  {isLogin ? 'Anmelden' : 'Registrieren'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={[styles.switchText, isDesktop && styles.switchTextDesktop]}>
                {isLogin
                  ? 'Noch kein Konto? Registrieren'
                  : 'Bereits ein Konto? Anmelden'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  scrollContentDesktop: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  formWrapper: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainerDesktop: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  titleDesktop: {
    fontSize: 36,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
  subtitleDesktop: {
    fontSize: 18,
  },
  form: {
    width: '100%',
  },
  formDesktop: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputContainerDesktop: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#fff',
    fontSize: 16,
  },
  inputDesktop: {
    height: 56,
    fontSize: 17,
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDesktop: {
    height: 56,
    marginTop: 16,
    borderRadius: 14,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDesktop: {
    fontSize: 18,
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  switchTextDesktop: {
    fontSize: 16,
  },
});
