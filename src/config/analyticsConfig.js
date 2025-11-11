/**
 * Configuration Analytics
 * Constantes et configurations pour le tracking
 */

export const ANALYTICS_EVENTS = {
  // Screen views
  SCREEN_HOME: 'screen_view_home',
  SCREEN_NEWS: 'screen_view_news',
  SCREEN_PLAYER: 'screen_view_player',
  SCREEN_FAVORITES: 'screen_view_favorites',
  SCREEN_STATS: 'screen_view_stats',
  SCREEN_PLAYLISTS: 'screen_view_playlists',
  SCREEN_SEARCH: 'screen_view_search',

  // User actions
  SONG_PLAYED: 'song_play',
  FAVORITE_ADDED: 'favorite_added',
  FAVORITE_REMOVED: 'favorite_removed',
  PLAYLIST_CREATED: 'playlist_created',
  PLAYLIST_DELETED: 'playlist_deleted',
  SONG_ADDED_TO_PLAYLIST: 'song_added_to_playlist',
  SONG_REMOVED_FROM_PLAYLIST: 'song_removed_from_playlist',

  // Player actions
  PLAY_PRESSED: 'play_pressed',
  PAUSE_PRESSED: 'pause_pressed',
  NEXT_PRESSED: 'next_pressed',
  PREVIOUS_PRESSED: 'previous_pressed',
  SEEK_PERFORMED: 'seek_performed',
  QUEUE_SHUFFLED: 'queue_shuffled',
  QUEUE_REPEATED: 'queue_repeated',

  // Search & Discovery
  SEARCH_EXECUTED: 'search_executed',
  SEARCH_RESULT_CLICKED: 'search_result_clicked',
  ALBUM_OPENED: 'album_opened',

  // Cross-party
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  ROOM_SYNC_ERROR: 'room_sync_error',

  // Authentication
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  OAUTH_STARTED: 'oauth_started',

  // Updates
  UPDATE_CHECKED: 'update_checked',
  UPDATE_AVAILABLE: 'update_available',
  UPDATE_DOWNLOADED: 'update_downloaded',
  UPDATE_DISMISSED: 'update_dismissed',

  // News
  NEWS_OPENED: 'news_opened',
  NEWS_BUTTON_CLICKED: 'news_button_clicked',
  NEWS_RELOADED: 'news_reloaded',

  // Errors & Analytics
  APP_ERROR: 'app_error',
  NAVIGATION_ERROR: 'navigation_error',
  API_ERROR: 'api_error',

  // Settings
  SETTINGS_CHANGED: 'settings_changed',
  STATS_VIEWED: 'stats_viewed',
  STATS_EXPORTED: 'stats_exported',
  STATS_RESET: 'stats_reset',

  // Development
  DEV_BANNER_CLICKED: 'dev_banner_clicked',
  DEV_SCREEN_OPENED: 'dev_screen_opened',
};

export const ANALYTICS_USER_PROPERTIES = {
  USER_ID: 'user_id',
  DEVICE_MODEL: 'device_model',
  OS_VERSION: 'os_version',
  APP_LANGUAGE: 'app_language',
  SUBSCRIPTION_TYPE: 'subscription_type',
  FIRST_LAUNCH_DATE: 'first_launch_date',
  IS_PREMIUM: 'is_premium',
};

/**
 * Objets de paramètres pré-définis pour les événements courants
 */
export const getEventParams = (eventType, data = {}) => {
  const timestamp = new Date().toISOString();

  switch (eventType) {
    case ANALYTICS_EVENTS.SONG_PLAYED:
      return {
        song_title: data.title,
        album_title: data.album,
        duration: data.duration,
        timestamp,
      };

    case ANALYTICS_EVENTS.FAVORITE_ADDED:
      return {
        song_title: data.title,
        song_id: data.id,
        timestamp,
      };

    case ANALYTICS_EVENTS.SEARCH_EXECUTED:
      return {
        search_query: data.query,
        result_count: data.resultCount,
        search_type: data.type || 'general',
        timestamp,
      };

    case ANALYTICS_EVENTS.ALBUM_OPENED:
      return {
        album_title: data.title,
        album_id: data.id,
        song_count: data.songCount,
        timestamp,
      };

    case ANALYTICS_EVENTS.ROOM_CREATED:
      return {
        room_id: data.roomId,
        room_name: data.roomName,
        max_participants: data.maxParticipants,
        timestamp,
      };

    case ANALYTICS_EVENTS.ROOM_JOINED:
      return {
        room_id: data.roomId,
        room_name: data.roomName,
        participant_count: data.participantCount,
        timestamp,
      };

    case ANALYTICS_EVENTS.UPDATE_AVAILABLE:
      return {
        current_version: data.currentVersion,
        new_version: data.newVersion,
        update_type: data.updateType || 'major',
        timestamp,
      };

    case ANALYTICS_EVENTS.APP_ERROR:
      return {
        error_message: data.message,
        error_type: data.type || 'unknown',
        error_stack: data.stack,
        timestamp,
      };

    default:
      return {
        ...data,
        timestamp,
      };
  }
};

export default {
  ANALYTICS_EVENTS,
  ANALYTICS_USER_PROPERTIES,
  getEventParams,
};
