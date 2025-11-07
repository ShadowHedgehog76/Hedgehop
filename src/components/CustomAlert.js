import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const showAlert = (config) => {
    const id = Date.now() + Math.random();
    const alert = {
      id,
      title: config.title || 'Notice',
      message: config.message || '',
      buttons: config.buttons || [{ text: 'OK', style: 'default' }],
      type: config.type || 'info', // 'info', 'success', 'warning', 'error'
    };
    setAlerts((prev) => [...prev, alert]);
  };

  const dismissAlert = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alerts.map((alert) => (
        <AlertModal key={alert.id} alert={alert} onDismiss={() => dismissAlert(alert.id)} />
      ))}
    </AlertContext.Provider>
  );
}

function AlertModal({ alert, onDismiss }) {
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleButtonPress = (button) => {
    if (button.onPress) {
      button.onPress();
    }
    onDismiss();
  };

  const getIcon = () => {
    switch (alert.type) {
      case 'success':
        return { name: 'checkmark-circle', color: '#34c759' };
      case 'warning':
        return { name: 'warning', color: '#ff9500' };
      case 'error':
        return { name: 'close-circle', color: '#ff3b30' };
      default:
        return { name: 'information-circle', color: '#1f4cff' };
    }
  };

  const icon = getIcon();

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onDismiss} />
        <View style={styles.alertCard}>
          <LinearGradient
            colors={['#1a1a1a', '#2a2a2a']}
            style={StyleSheet.absoluteFillObject}
          />
          
          <View style={styles.iconContainer}>
            <Ionicons name={icon.name} size={40} color={icon.color} />
          </View>

          <Text style={styles.title}>{alert.title}</Text>
          {alert.message ? <Text style={styles.message}>{alert.message}</Text> : null}

          <View style={styles.buttonContainer}>
            {alert.buttons.map((button, index) => {
              const isCancelStyle = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              const isDisabled = button.style === 'disabled';
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isCancelStyle && styles.cancelButton,
                    isDestructive && styles.destructiveButton,
                    isDisabled && styles.disabledButton,
                    alert.buttons.length === 1 && styles.singleButton,
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancelStyle && styles.cancelButtonText,
                      isDestructive && styles.destructiveButtonText,
                      isDisabled && styles.disabledButtonText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alertCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1f4cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  destructiveButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  disabledButton: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButtonText: {
    color: '#fff',
  },
  destructiveButtonText: {
    color: '#ff3b30',
  },
  disabledButtonText: {
    color: '#888',
  },
});
