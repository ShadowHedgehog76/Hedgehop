// YouScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';
import authService from '../src/services/auth';
import { syncFavoritesToCloud, syncFavoritesToLocal } from '../src/api/favorites';
import statsService from '../src/services/StatsService';

// Composants extraits pour éviter les re-rendus
const SettingsSection = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const SettingItem = ({ icon, title, subtitle, onPress, rightComponent }) => (
  <TouchableOpacity 
    style={styles.settingItem} 
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.settingLeft}>
      <Ionicons name={icon} size={24} color="#1f4cff" style={styles.settingIcon} />
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {rightComponent}
  </TouchableOpacity>
);

export default function YouScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const { isTablet } = useDeviceType();

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = authService.onAuthStateChanged((user) => {
      if (user) {
        setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        });
        setIsConnected(true);
      } else {
        setUser(null);
        setIsConnected(false);
      }
      if (initializing) setInitializing(false);
    });

    // Cleanup
    return unsubscribe;
  }, [initializing]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.login(email, password);
      
      if (result.success) {
        // Sync local favorites and stats to cloud
        await syncFavoritesToCloud();
        await statsService.syncStatsToCloud();
        
        setShowLogin(false);
        setEmail('');
        setPassword('');
        Alert.alert('Success', 'Signed in! Your favorites and stats have been synchronized.');
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.register(email, password, displayName);
      
      if (result.success) {
        // Sync local favorites and stats to cloud
        await syncFavoritesToCloud();
        await statsService.syncStatsToCloud();
        
        setShowRegister(false);
        setEmail('');
        setPassword('');
        setDisplayName('');
        Alert.alert('Success', 'Account created! Your favorites and stats have been synchronized.');
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            
            // Save favorites and stats locally before signing out
            await syncFavoritesToLocal();
            await statsService.syncStatsToLocal();
            
            const result = await authService.logout();
            setLoading(false);
            
            if (!result.success) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const resetForms = useCallback(() => {
    setShowLogin(false);
    setShowRegister(false);
    setEmail('');
    setPassword('');
    setDisplayName('');
  }, []);

  const handleEmailChange = useCallback((text) => {
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text) => {
    setPassword(text);
  }, []);

  const handleDisplayNameChange = useCallback((text) => {
    setDisplayName(text);
  }, []);

  // Affichage de chargement initial
  if (initializing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#1f4cff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }



  if (isTablet) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
          style={StyleSheet.absoluteFillObject}
        />
        
        <ScrollView style={styles.tabletContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.tabletTitle}>Your profile</Text>
          
          {/* Profile Section */}
          <SettingsSection title="Profile">
            {isConnected ? (
              <View style={styles.profileConnected}>
                <View style={styles.profileInfo}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={32} color="white" />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.logoutText}>Sign out</Text>
                </TouchableOpacity>
              </View>
            ) : showLogin ? (
              <View style={styles.loginForm}>
                <Text style={styles.formTitle}>Sign in</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  editable={!loading}
                />
                <View style={styles.loginButtons}>
                  <TouchableOpacity 
                    style={[styles.cancelButton, loading && styles.disabledButton]} 
                    onPress={resetForms}
                    disabled={loading}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.loginButton, loading && styles.disabledButton]} 
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.loginButtonText}>Sign in</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.switchFormButton}
                  onPress={() => {
                    setShowLogin(false);
                    setShowRegister(true);
                  }}
                  disabled={loading}
                >
                  <Text style={styles.switchFormText}>No account yet? Sign up</Text>
                </TouchableOpacity>
              </View>
            ) : showRegister ? (
              <View style={styles.loginForm}>
                <Text style={styles.formTitle}>Create an account</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Display name"
                  placeholderTextColor="#666"
                  value={displayName}
                  onChangeText={handleDisplayNameChange}
                  editable={!loading}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  editable={!loading}
                />
                <View style={styles.loginButtons}>
                  <TouchableOpacity 
                    style={[styles.cancelButton, loading && styles.disabledButton]} 
                    onPress={resetForms}
                    disabled={loading}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.loginButton, loading && styles.disabledButton]} 
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.loginButtonText}>Sign up</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.switchFormButton}
                  onPress={() => {
                    setShowRegister(false);
                    setShowLogin(true);
                  }}
                  disabled={loading}
                >
                  <Text style={styles.switchFormText}>Already have an account? Sign in</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <SettingItem
                icon="log-in"
                title="Sign in"
                subtitle="Save your favorites and settings"
                onPress={() => setShowLogin(true)}
                rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
              />
            )}
          </SettingsSection>

          {/* CrossParty supprimé */}

          {/* Library */}
          <SettingsSection title="Library">
            <SettingItem
              icon="musical-notes"
              title="Playlists"
              subtitle="Manage your playlists"
              onPress={() => navigation.navigate('Playlists')}
              rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
            />
          </SettingsSection>

          {/* Other */}
          <SettingsSection title="About">
            <SettingItem
              icon="help-circle"
              title="Help & support"
              onPress={() => Alert.alert('Help', 'Feature in development')}
              rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
            />
            <SettingItem
              icon="information-circle"
              title="About Hedgehop"
              onPress={() => Alert.alert('Hedgehop', 'Version 1.0.0\nMusic Player App')}
              rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
            />
          </SettingsSection>
        </ScrollView>
      </View>
    );
  }

  // Phone layout
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>You</Text>
        
        {/* Profile Section - Phone */}
        <SettingsSection title="Profile">
          {isConnected ? (
            <View style={styles.profileConnected}>
              <View style={styles.profileInfo}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={28} color="white" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : showLogin ? (
            <View style={styles.loginForm}>
              <Text style={styles.formTitle}>Sign in</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
              <View style={styles.loginButtons}>
                <TouchableOpacity 
                  style={[styles.cancelButton, loading && styles.disabledButton]} 
                  onPress={resetForms}
                  disabled={loading}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.loginButton, loading && styles.disabledButton]} 
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign in</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.switchFormButton}
                onPress={() => {
                  setShowLogin(false);
                  setShowRegister(true);
                }}
                disabled={loading}
              >
                <Text style={styles.switchFormText}>No account yet? Sign up</Text>
              </TouchableOpacity>
            </View>
          ) : showRegister ? (
            <View style={styles.loginForm}>
              <Text style={styles.formTitle}>Create an account</Text>
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor="#666"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Password (min. 6 characters)"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
              <View style={styles.loginButtons}>
                <TouchableOpacity 
                  style={[styles.cancelButton, loading && styles.disabledButton]} 
                  onPress={resetForms}
                  disabled={loading}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.loginButton, loading && styles.disabledButton]} 
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign up</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.switchFormButton}
                onPress={() => {
                  setShowRegister(false);
                  setShowLogin(true);
                }}
                disabled={loading}
              >
                <Text style={styles.switchFormText}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.authButtons}>
              <TouchableOpacity style={styles.authButton} onPress={() => setShowLogin(true)}>
                <Ionicons name="log-in" size={20} color="#1f4cff" />
                <Text style={styles.authButtonText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.authButton} onPress={() => setShowRegister(true)}>
                <Ionicons name="person-add" size={20} color="#1f4cff" />
                <Text style={styles.authButtonText}>Sign up</Text>
              </TouchableOpacity>
            </View>
          )}
        </SettingsSection>

        {/* CrossParty supprimé */}

        {/* Library - Phone */}
        <SettingsSection title="Library">
          <SettingItem
            icon="musical-notes"
            title="Playlists"
            subtitle="Manage your playlists"
            onPress={() => navigation.navigate('Playlists')}
            rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
          />
        </SettingsSection>

        {/* Other - Phone */}
        <SettingsSection title="About">
          <SettingItem
            icon="help-circle"
            title="Help & support"
            onPress={() => Alert.alert('Help', 'Feature in development')}
            rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
          />
          <SettingItem
            icon="information-circle"
            title="About"
            onPress={() => Alert.alert('Hedgehop', 'Version 1.0.0\nMusic Player App')}
            rightComponent={<Ionicons name="chevron-forward" size={20} color="#666" />}
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabletContent: {
    flex: 1,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 60,
    marginBottom: 30,
  },
  tabletTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 40,
    marginBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 15,
    marginLeft: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  profileConnected: {
    backgroundColor: 'rgba(31,76,255,0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.3)',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1f4cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,59,48,0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  logoutText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  loginForm: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  loginButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#aaa',
    fontWeight: '600',
  },
  loginButton: {
    flex: 1,
    backgroundColor: '#1f4cff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  switchFormButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchFormText: {
    color: '#1f4cff',
    fontSize: 14,
    fontWeight: '600',
  },
  authButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  authButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,76,255,0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.3)',
    gap: 8,
  },
  authButtonText: {
    color: '#1f4cff',
    fontWeight: '600',
    fontSize: 14,
  },
});