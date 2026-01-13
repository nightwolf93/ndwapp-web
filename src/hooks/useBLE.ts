import { useState, useEffect, useCallback } from 'react';
import bleService from '../services/bleService';
import type { DeviceInfo, DeviceSettings } from '../services/bleService';

export interface UseBLEReturn {
  // Connection state
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Device data
  deviceInfo: DeviceInfo | null;
  images: string[];
  settings: DeviceSettings | null;

  // Connection actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Data refresh
  refreshInfo: () => Promise<void>;
  refreshImages: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Image actions
  displayImage: (name: string) => Promise<boolean>;
  nextImage: () => Promise<boolean>;
  previousImage: () => Promise<boolean>;
  deleteImage: (name: string) => Promise<boolean>;
  deleteAllImages: () => Promise<boolean>;
  uploadImage: (name: string, data: Uint8Array, onProgress?: (sent: number, total: number) => void) => Promise<boolean>;

  // Settings actions
  setSlideshow: (enabled: boolean) => Promise<boolean>;
  setInterval: (minutes: number) => Promise<boolean>;

  // Device actions
  restart: () => Promise<boolean>;
  sleep: () => Promise<boolean>;
}

export function useBLE(): UseBLEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [settings, setSettings] = useState<DeviceSettings | null>(null);

  const isSupported = bleService.isSupported();

  // Subscribe to connection changes
  useEffect(() => {
    const unsubscribe = bleService.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (!connected) {
        setDeviceInfo(null);
        setImages([]);
        setSettings(null);
      }
    });

    return unsubscribe;
  }, []);

  // Connect to device
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await bleService.connect();
      // Refresh all data after connection
      await Promise.all([
        bleService.getInfo().then(setDeviceInfo).catch(console.error),
        bleService.getImages().then(setImages).catch(console.error),
        bleService.getSettings().then(setSettings).catch(console.error),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    await bleService.disconnect();
  }, []);

  // Refresh functions
  const refreshInfo = useCallback(async () => {
    if (!isConnected) return;
    try {
      const info = await bleService.getInfo();
      setDeviceInfo(info);
    } catch (err) {
      console.error('Failed to refresh info:', err);
    }
  }, [isConnected]);

  const refreshImages = useCallback(async () => {
    if (!isConnected) return;
    try {
      const list = await bleService.getImages();
      setImages(list);
    } catch (err) {
      console.error('Failed to refresh images:', err);
    }
  }, [isConnected]);

  const refreshSettings = useCallback(async () => {
    if (!isConnected) return;
    try {
      const s = await bleService.getSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to refresh settings:', err);
    }
  }, [isConnected]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshInfo(), refreshImages(), refreshSettings()]);
  }, [refreshInfo, refreshImages, refreshSettings]);

  // Image actions
  const displayImage = useCallback(async (name: string): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.displayImage(name);
      await refreshSettings(); // Refresh to get current image
      return result;
    } catch (err) {
      console.error('Failed to display image:', err);
      return false;
    }
  }, [isConnected, refreshSettings]);

  const nextImage = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.nextImage();
      await refreshSettings();
      return result;
    } catch (err) {
      console.error('Failed to go to next image:', err);
      return false;
    }
  }, [isConnected, refreshSettings]);

  const previousImage = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.previousImage();
      await refreshSettings();
      return result;
    } catch (err) {
      console.error('Failed to go to previous image:', err);
      return false;
    }
  }, [isConnected, refreshSettings]);

  const deleteImage = useCallback(async (name: string): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.deleteImage(name);
      if (result) {
        await refreshImages();
        await refreshInfo();
      }
      return result;
    } catch (err) {
      console.error('Failed to delete image:', err);
      return false;
    }
  }, [isConnected, refreshImages, refreshInfo]);

  const deleteAllImages = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.deleteAllImages();
      if (result) {
        await refreshImages();
        await refreshInfo();
      }
      return result;
    } catch (err) {
      console.error('Failed to delete all images:', err);
      return false;
    }
  }, [isConnected, refreshImages, refreshInfo]);

  const uploadImage = useCallback(async (
    name: string,
    data: Uint8Array,
    onProgress?: (sent: number, total: number) => void
  ): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.uploadImage(name, data, onProgress);
      if (result) {
        await refreshImages();
        await refreshInfo();
      }
      return result;
    } catch (err) {
      console.error('Failed to upload image:', err);
      return false;
    }
  }, [isConnected, refreshImages, refreshInfo]);

  // Settings actions
  const setSlideshow = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.setSlideshow(enabled);
      if (result) {
        await refreshSettings();
      }
      return result;
    } catch (err) {
      console.error('Failed to set slideshow:', err);
      return false;
    }
  }, [isConnected, refreshSettings]);

  const setIntervalMinutes = useCallback(async (minutes: number): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      const result = await bleService.setInterval(minutes);
      if (result) {
        await refreshSettings();
      }
      return result;
    } catch (err) {
      console.error('Failed to set interval:', err);
      return false;
    }
  }, [isConnected, refreshSettings]);

  // Device actions
  const restart = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      return await bleService.restart();
    } catch (err) {
      console.error('Failed to restart:', err);
      return false;
    }
  }, [isConnected]);

  const sleep = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    try {
      return await bleService.sleep();
    } catch (err) {
      console.error('Failed to sleep:', err);
      return false;
    }
  }, [isConnected]);

  return {
    isSupported,
    isConnected,
    isConnecting,
    error,
    deviceInfo,
    images,
    settings,
    connect,
    disconnect,
    refreshInfo,
    refreshImages,
    refreshSettings,
    refreshAll,
    displayImage,
    nextImage,
    previousImage,
    deleteImage,
    deleteAllImages,
    uploadImage,
    setSlideshow,
    setInterval: setIntervalMinutes,
    restart,
    sleep,
  };
}
