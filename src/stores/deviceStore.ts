// Simple device store using localStorage for persistence
import type { DeviceInfo, DeviceSettings } from '../services/bleService';

export interface PairedDevice {
  id: string;
  name: string;
  type: 'eink-frame';
  addedAt: number;
  lastConnected?: number;
}

interface DeviceState {
  pairedDevices: PairedDevice[];
  activeDeviceId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  deviceInfo: DeviceInfo | null;
  settings: DeviceSettings | null;
  images: string[];
}

type Listener = () => void;

class DeviceStore {
  private state: DeviceState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = {
      pairedDevices: this.loadPairedDevices(),
      activeDeviceId: null,
      isConnected: false,
      isConnecting: false,
      deviceInfo: null,
      settings: null,
      images: [],
    };
  }

  // Load paired devices from localStorage
  private loadPairedDevices(): PairedDevice[] {
    try {
      const stored = localStorage.getItem('paired-devices');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Save paired devices to localStorage
  private savePairedDevices() {
    try {
      localStorage.setItem('paired-devices', JSON.stringify(this.state.pairedDevices));
    } catch {
      // Ignore storage errors
    }
  }

  // Subscribe to state changes
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners
  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // Get current state
  getState(): DeviceState {
    return this.state;
  }

  // Add a new paired device
  addPairedDevice(device: Omit<PairedDevice, 'addedAt'>) {
    // Check if already paired
    if (this.state.pairedDevices.some((d) => d.id === device.id)) {
      return;
    }

    this.state = {
      ...this.state,
      pairedDevices: [
        ...this.state.pairedDevices,
        { ...device, addedAt: Date.now() },
      ],
    };
    this.savePairedDevices();
    this.notify();
  }

  // Remove a paired device
  removePairedDevice(deviceId: string) {
    this.state = {
      ...this.state,
      pairedDevices: this.state.pairedDevices.filter((d) => d.id !== deviceId),
    };
    this.savePairedDevices();
    this.notify();
  }

  // Update last connected time
  updateLastConnected(deviceId: string) {
    this.state = {
      ...this.state,
      pairedDevices: this.state.pairedDevices.map((d) =>
        d.id === deviceId ? { ...d, lastConnected: Date.now() } : d
      ),
    };
    this.savePairedDevices();
    this.notify();
  }

  // Set active device
  setActiveDevice(deviceId: string | null) {
    this.state = {
      ...this.state,
      activeDeviceId: deviceId,
    };
    this.notify();
  }

  // Set connection state
  setConnecting(isConnecting: boolean) {
    this.state = {
      ...this.state,
      isConnecting,
    };
    this.notify();
  }

  // Set connected state
  setConnected(isConnected: boolean) {
    this.state = {
      ...this.state,
      isConnected,
      isConnecting: false,
    };
    this.notify();
  }

  // Set device info
  setDeviceInfo(deviceInfo: DeviceInfo | null) {
    this.state = {
      ...this.state,
      deviceInfo,
    };
    this.notify();
  }

  // Set settings
  setSettings(settings: DeviceSettings | null) {
    this.state = {
      ...this.state,
      settings,
    };
    this.notify();
  }

  // Set images
  setImages(images: string[]) {
    this.state = {
      ...this.state,
      images,
    };
    this.notify();
  }

  // Reset connection state
  resetConnection() {
    this.state = {
      ...this.state,
      isConnected: false,
      isConnecting: false,
      deviceInfo: null,
      settings: null,
      images: [],
    };
    this.notify();
  }
}

// Singleton instance
export const deviceStore = new DeviceStore();

// React hook for using the store
import { useSyncExternalStore } from 'react';

export function useDeviceStore() {
  return useSyncExternalStore(
    (listener) => deviceStore.subscribe(listener),
    () => deviceStore.getState()
  );
}
