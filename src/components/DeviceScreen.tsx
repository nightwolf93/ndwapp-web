import { useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Image as ImageIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  RefreshCw,
  XCircle,
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

// Upload error info
interface UploadError {
  message: string;
  progress: number;
  timestamp: number;
}

export function DeviceScreen({
  device: _device,
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
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const { success, error } = useToast();

  // Clear upload error
  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

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

  // Upload handlers with detailed error tracking
  const handleUpload = useCallback(async (
    name: string,
    data: Uint8Array,
    onProgress: (sent: number, total: number) => void
  ): Promise<boolean> => {
    setUploadError(null);
    let lastProgress = 0;
    
    const trackProgress = (sent: number, total: number) => {
      lastProgress = Math.round((sent / total) * 100);
      onProgress(sent, total);
    };

    try {
      const result = await bleService.uploadImage(name, data, trackProgress);
      if (result) {
        await handleRefresh();
        success(`"${name}" uploaded`);
      }
      return result;
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Unknown error';
      
      // Determine user-friendly error message
      let friendlyMessage = 'Upload failed';
      if (errorMsg.toLowerCase().includes('disconnect')) {
        friendlyMessage = 'Connection lost during upload';
      } else if (errorMsg.includes('GATT')) {
        friendlyMessage = 'Bluetooth communication error';
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        friendlyMessage = 'Upload timed out';
      } else if (errorMsg.toLowerCase().includes('not connected')) {
        friendlyMessage = 'Device disconnected';
      }
      
      setUploadError({
        message: friendlyMessage,
        progress: lastProgress,
        timestamp: Date.now(),
      });
      
      console.error('[Upload] Failed:', errorMsg);
      return false;
    }
  }, [handleRefresh, success]);

  const handleUploadAndDisplay = useCallback(async (
    name: string,
    data: Uint8Array,
    onProgress: (sent: number, total: number) => void
  ): Promise<boolean> => {
    setUploadError(null);
    let lastProgress = 0;
    
    const trackProgress = (sent: number, total: number) => {
      lastProgress = Math.round((sent / total) * 100);
      onProgress(sent, total);
    };

    try {
      const uploadResult = await bleService.uploadImage(name, data, trackProgress);
      if (uploadResult) {
        await bleService.displayImage(name);
        await handleRefresh();
        success(`"${name}" displayed`);
        return true;
      }
      return false;
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Unknown error';
      
      let friendlyMessage = 'Upload failed';
      if (errorMsg.toLowerCase().includes('disconnect')) {
        friendlyMessage = 'Connection lost during upload';
      } else if (errorMsg.includes('GATT')) {
        friendlyMessage = 'Bluetooth communication error';
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        friendlyMessage = 'Upload timed out';
      } else if (errorMsg.toLowerCase().includes('not connected')) {
        friendlyMessage = 'Device disconnected';
      }
      
      setUploadError({
        message: friendlyMessage,
        progress: lastProgress,
        timestamp: Date.now(),
      });
      
      console.error('[Upload] Failed:', errorMsg);
      return false;
    }
  }, [handleRefresh, success]);

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

  // Not connected state - with upload error display
  if (!isConnected && !isConnecting) {
    return (
      <div className="device-screen">
        {/* Show upload error if it just happened */}
        {uploadError && (Date.now() - uploadError.timestamp) < 60000 && (
          <div className="upload-error-banner">
            <div className="upload-error-icon">
              <XCircle size={24} />
            </div>
            <div className="upload-error-content">
              <div className="upload-error-title">{uploadError.message}</div>
              <div className="upload-error-detail">
                Upload stopped at {uploadError.progress}%
              </div>
            </div>
            <button className="upload-error-close" onClick={clearUploadError}>
              ×
            </button>
          </div>
        )}

        <div className="connection-status error">
          <div className="connection-icon">
            <WifiOff size={20} />
          </div>
          <div className="connection-info">
            <div className="connection-title">Disconnected</div>
            <div className="connection-subtitle">
              {uploadError 
                ? 'Connection was lost. Turn the device OFF then ON to reconnect.'
                : 'Turn the device OFF then ON to make it available'
              }
            </div>
          </div>
        </div>
        
        <Button onClick={onConnect} size="lg" className="btn-full">
          Reconnect
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
            uploadError={uploadError}
            onClearError={clearUploadError}
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
