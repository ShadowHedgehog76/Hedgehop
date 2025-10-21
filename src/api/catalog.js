// src/api/catalog.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const RAW_URL_PRIMARY =
  'https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop-Data/refs/heads/main/sonic_music_catalog.json';
// Fallback "classique" si jamais le primary renvoie 404/403
const RAW_URL_FALLBACK =
  'https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop-Data/main/sonic_music_catalog.json';

const STORAGE_KEY = 'hedgehog_catalog_json';
const STORAGE_TIME_KEY = 'hedgehog_catalog_saved_at';

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 15000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function downloadCatalog() {
  // essaie l’URL donnée par toi, puis fallback si besoin
  let res = await fetchWithTimeout(RAW_URL_PRIMARY).catch(() => null);
  if (!res || !res.ok) {
    res = await fetchWithTimeout(RAW_URL_FALLBACK).catch(() => null);
  }
  if (!res || !res.ok) {
    const msg = `Download failed (${res ? res.status : 'network error'})`;
    throw new Error(msg);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON received');
  }

  // Sauvegarde cache
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(json));
  await AsyncStorage.setItem(STORAGE_TIME_KEY, String(Date.now()));
  return json;
}

export async function getCatalog({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // cache corrompu → on redescend
      }
    }
  }
  return downloadCatalog();
}

export async function getCatalogMeta() {
  const ts = await AsyncStorage.getItem(STORAGE_TIME_KEY);
  return { savedAt: ts ? Number(ts) : null };
}

export function formatSavedAt(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}
