import { useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Image as ImageIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui';
import { Gallery } from './Gallery';
import { Upload } from './Upload';
import { Settings } from './Settings';
import { bleService, type DeviceInfo, type DeviceSettings } from '../services/bleService';
import { deviceStore } from '../stores/deviceStore';
import { useToast } from './Toast';
import type { PairedDevice } from '../stores/deviceStore';

type Tab = 'gallery' | 'upload' | 'settings';

interface DeviceScreenProps {
  device: PairedDevice;
  isConnected: boolean;
  isConnecting: boolean;
  deviceInfo: DeviceInfo | null;
  settings: DeviceSettings | null;
  images: string[];
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DeviceScreen({
  isConnected,
  isConnecting,
  deviceInfo,
  settings,
  images,
  onConnect,
  onDisconnect,
}: DeviceScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('gallery');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { success, error } = useToast();

  // Refresh device data
  const handleRefresh = useCallback(async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const [info, settingsData, imageList] = await Promise.all([
        bleService.getInfo(),
        bleService.getSettings(),
        bleService.getImages(),
      ]);
      deviceStore.setDeviceInfo(info);
      deviceStore.setSettings(settingsData);
      deviceStore.setImages(imageList);
    } catch (err) {
      error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  }, [isConnected, error]);

  // Upload handlers
  const handleUpload = useCallback(async (
    name: string,
    data: Uint8Array,
    onProgress: (sent: number, total: number) => void
  ): Promise<boolean> => {
    try {
      const result = await bleService.uploadImage(name, data, onProgress);
      if (result) {
        await handleRefresh();
        success(`"${name}" uploaded`);
      }
      return result;
    } catch (err) {
      error('Upload failed');
      return false;
    }
  }, [handleRefresh, success, error]);

  const handleUploadAndDisplay = useCallback(async (
    name: string,
    data: Uint8Array,
    onProgress: (sent: number, total: number) => void
  ): Promise<boolean> => {
    try {
      const uploadResult = await bleService.uploadImage(name, data, onProgress);
      if (uploadResult) {
        await bleService.displayImage(name);
        await handleRefresh();
        success(`"${name}" displayed`);
        return true;
      }
      return false;
    } catch (err) {
      error('Upload failed');
      return false;
    }
  }, [handleRefresh, success, error]);

  // Gallery handlers
  const handleDisplay = useCallback(async (name: string): Promise<boolean> => {
    try {
      const result = await bleService.displayImage(name);
      if (result) {
        await handleRefresh();
        success(`Displaying "${name}"`);
      }
      return result;
    } catch (err) {
      return false;
    }
  }, [handleRefresh, success]);

  const handleDelete = useCallback(async (name: string): Promise<boolean> => {
    try {
      const result = await bleService.deleteImage(name);
      if (result) {
        await handleRefresh();
        success(`"${name}" deleted`);
      }
      return result;
    } catch (err) {
      error('Delete failed');
      return false;
    }
  }, [handleRefresh, success, error]);

  const handleDeleteAll = useCallback(async (): Promise<boolean> => {
    try {
      const result = await bleService.deleteAllImages();
      if (result) {
        await handleRefresh();
        success('All images deleted');
      }
      return result;
    } catch (err) {
      error('Delete failed');
      return false;
    }
  }, [handleRefresh, success, error]);

  // Settings handlers
  const handleSetSlideshow = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await bleService.setSlideshow(enabled);
      if (result) {
        await handleRefresh();
        success(enabled ? 'Slideshow enabled' : 'Slideshow disabled');
      }
      return result;
    } catch (err) {
      return false;
    }
  }, [handleRefresh, success]);

  const handleSetInterval = useCallback(async (minutes: number): Promise<boolean> => {
    try {
      const result = await bleService.setInterval(minutes);
      if (result) {
        await handleRefresh();
        success(`Interval set to ${minutes} min`);
      }
      return result;
    } catch (err) {
      return false;
    }
  }, [handleRefresh, success]);

  const handleRestart = useCallback(async (): Promise<boolean> => {
    try {
      const result = await bleService.restart();
      if (result) {
        success('Restarting device...');
      }
      return result;
    } catch (err) {
      return false;
    }
  }, [success]);

  const handleSleep = useCallback(async (): Promise<boolean> => {
    try {
      const result = await bleService.sleep();
      if (result) {
        success('Device entering sleep mode...');
      }
      return result;
    } catch (err) {
      return false;
    }
  }, [success]);

  // Not connected state
  if (!isConnected && !isConnecting) {
    return (
      <div className="device-screen">
        <div className="connection-status error">
          <div className="connection-icon">
            <WifiOff size={20} />
          </div>
          <div className="connection-info">
            <div className="connection-title">Not Connected</div>
            <div className="connection-subtitle">
              Turn the device OFF then ON to make it available
            </div>
          </div>
        </div>
        <Button onClick={onConnect} size="lg" className="btn-full">
          Connect
        </Button>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="device-screen">
        <div className="connection-status">
          <div className="connection-icon">
            <RefreshCw size={20} className="animate-spin" />
          </div>
          <div className="connection-info">
            <div className="connection-title">Connecting...</div>
            <div className="connection-subtitle">Please wait</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="device-screen">
      {/* Connection status */}
      <div className="connection-status connected">
        <div className="connection-icon">
          <Wifi size={20} />
        </div>
        <div className="connection-info">
          <div className="connection-title">Connected</div>
          <div className="connection-subtitle">
            {deviceInfo ? `${deviceInfo.images}/${deviceInfo.max} images` : 'Loading...'}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>

      {/* Tab navigation */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          <ImageIcon size={18} />
          Gallery
        </button>
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <UploadIcon size={18} />
          Upload
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={18} />
          Settings
        </button>
      </nav>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'gallery' && (
          <Gallery
            images={images}
            settings={settings}
            onDisplay={handleDisplay}
            onDelete={handleDelete}
            onDeleteAll={handleDeleteAll}
            onPrevious={bleService.previousImage.bind(bleService)}
            onNext={bleService.nextImage.bind(bleService)}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}

        {activeTab === 'upload' && (
          <Upload
            onUpload={handleUpload}
            onUploadAndDisplay={handleUploadAndDisplay}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            deviceInfo={deviceInfo}
            onSetSlideshow={handleSetSlideshow}
            onSetInterval={handleSetInterval}
            onRestart={handleRestart}
            onSleep={handleSleep}
          />
        )}
      </div>
    </div>
  );
}
