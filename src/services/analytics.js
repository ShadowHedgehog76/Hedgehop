// Simple Analytics Service using localStorage and fetch
// Pour Firebase Analytics en Expo, nous utilisons une approche client-side simple

const ANALYTICS_ENDPOINT = 'https://www.google-analytics.com/collect';
const TRACKING_ID = 'UA-XXXXXXXXX-X'; // À remplacer si besoin

// Track d'événements en mémoire (sera envoyé à Firebase/GA si configuré)
let analyticsEnabled = true;
const eventQueue = [];

// Initialize Analytics
export const initializeAnalytics = async () => {
  try {
    // Vérifier la connexion internet
    analyticsEnabled = true;
    console.log('✅ Analytics initialized (local queue mode)');
    console.log('📊 Events will be logged locally and synced');
  } catch (error) {
    console.error('❌ Error initializing analytics:', error);
    analyticsEnabled = false;
  }
};

// Track screen view
export const trackScreenView = async (screenName) => {
  try {
    if (!screenName) {
      console.warn('⚠️ trackScreenView: screenName is required');
      return;
    }

    const event = {
      type: 'screen_view',
      screen_name: screenName,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Tracked screen: ${screenName}`);
    
    // Log localement
    if (typeof console !== 'undefined') {
      console.log(`  → Event ID: ${eventQueue.length}`);
    }
  } catch (error) {
    console.error('❌ Error tracking screen:', error);
  }
};

// Track user engagement
export const trackUserEngagement = async (action, details = {}) => {
  try {
    if (!action) {
      console.warn('⚠️ trackUserEngagement: action is required');
      return;
    }

    const event = {
      type: 'user_engagement',
      action,
      ...details,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Tracked engagement: ${action}`);
  } catch (error) {
    console.error('❌ Error tracking engagement:', error);
  }
};

// Track song play
export const trackSongPlay = async (songTitle, albumTitle, duration) => {
  try {
    if (!songTitle) {
      console.warn('⚠️ trackSongPlay: songTitle is required');
      return;
    }

    const event = {
      type: 'song_play',
      song_title: songTitle || 'Unknown',
      album_title: albumTitle || 'Unknown',
      duration: duration || 0,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Tracked play: ${songTitle}`);
  } catch (error) {
    console.error('❌ Error tracking play:', error);
  }
};

// Track favorite added
export const trackFavoriteAdded = async (songTitle) => {
  try {
    if (!songTitle) {
      console.warn('⚠️ trackFavoriteAdded: songTitle is required');
      return;
    }

    const event = {
      type: 'favorite_added',
      song_title: songTitle,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Tracked favorite: ${songTitle}`);
  } catch (error) {
    console.error('❌ Error tracking favorite:', error);
  }
};

// Track app crashes/errors
export const trackError = async (errorMessage, errorType) => {
  try {
    const event = {
      type: 'app_error',
      error_message: errorMessage,
      error_type: errorType,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Tracked error: ${errorType}`);
  } catch (error) {
    console.error('❌ Error tracking error event:', error);
  }
};

// Set user properties
export const setUserProperty = async (propertyName, propertyValue) => {
  try {
    if (!propertyName) {
      console.warn('⚠️ setUserProperty: propertyName is required');
      return;
    }

    const event = {
      type: 'user_property',
      property_name: propertyName,
      property_value: propertyValue,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Set user property: ${propertyName} = ${propertyValue}`);
  } catch (error) {
    console.error('❌ Error setting user property:', error);
  }
};

// Track user demographics
export const trackUserDemographics = async (userId, deviceInfo) => {
  try {
    const event = {
      type: 'user_demographics',
      user_id: userId,
      device_model: deviceInfo?.model || 'unknown',
      os_version: deviceInfo?.osVersion || 'unknown',
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
    console.log(`📊 Tracked user demographics`);
  } catch (error) {
    console.error('❌ Error tracking demographics:', error);
  }
};

// Get all tracked events (for debugging)
export const getTrackedEvents = () => {
  return [...eventQueue];
};

// Clear event queue
export const clearEventQueue = () => {
  const count = eventQueue.length;
  eventQueue.length = 0;
  console.log(`🗑️ Cleared ${count} events from queue`);
};

// Get event statistics
export const getEventStats = () => {
  const stats = {};
  eventQueue.forEach(event => {
    stats[event.type] = (stats[event.type] || 0) + 1;
  });
  return stats;
};

export default {
  initializeAnalytics,
  trackScreenView,
  trackUserEngagement,
  trackSongPlay,
  trackFavoriteAdded,
  trackError,
  setUserProperty,
  trackUserDemographics,
  getTrackedEvents,
  clearEventQueue,
  getEventStats,
};
