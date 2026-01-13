import { useState, useCallback, useEffect } from 'react';
import { 
  Bluetooth, 
  BluetoothOff,
  Plus,
  ChevronLeft,
  ChevronRight,
  Scan,
  AlertTriangle,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { Button } from './components/ui';
import { Card } from './components/ui';
import { Badge } from './components/ui';
import { bleService } from './services/bleService';
import { useDeviceStore, deviceStore, type PairedDevice } from './stores/deviceStore';
import { DeviceScreen } from './components/DeviceScreen';
import { ToastContainer, useToast } from './components/Toast';
import eframeIcon from './assets/eframe_1.png';
import './App.css';

// Device types available
interface DeviceType {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'eink-frame';
}

const DEVICE_TYPES: DeviceType[] = [
  {
    id: 'eink-frame-one',
    name: 'E-Ink Frame One',
    description: '7.5" E-Paper Display • 800×480',
    icon: eframeIcon,
    type: 'eink-frame',
  },
];

type Screen = 'devices' | 'select-type' | 'scan' | 'device';

function App() {
  const [screen, setScreen] = useState<Screen>('devices');
  const [selectedDevice, setSelectedDevice] = useState<PairedDevice | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<PairedDevice | null>(null);
  
  const store = useDeviceStore();
  const { toasts, removeToast, success, error } = useToast();
  
  const isSupported = bleService.isSupported();
  const unsupportedReason = !isSupported ? bleService.getUnsupportedReason() : null;

  // Handle device connection change
  useEffect(() => {
    const unsubscribe = bleService.onConnectionChange((connected) => {
      deviceStore.setConnected(connected);
      if (!connected && screen === 'device') {
        deviceStore.resetConnection();
      }
    });
    return unsubscribe;
  }, [screen]);

  // Open device screen
  const handleOpenDevice = useCallback(async (device: PairedDevice) => {
    setSelectedDevice(device);
    setScreen('device');
    
    // Auto-connect
    deviceStore.setConnecting(true);
    try {
      await bleService.connect();
      deviceStore.setConnected(true);
      deviceStore.updateLastConnected(device.id);
      
      // Load device data
      const [info, settings, images] = await Promise.all([
        bleService.getInfo(),
        bleService.getSettings(),
        bleService.getImages(),
      ]);
      deviceStore.setDeviceInfo(info);
      deviceStore.setSettings(settings);
      deviceStore.setImages(images);
      
      success('Connected to device');
    } catch (err) {
      deviceStore.setConnecting(false);
      error('Turn the device OFF then ON to make it available');
    }
  }, [success, error]);

  // Handle device type selection
  const handleSelectDeviceType = useCallback((deviceType: DeviceType) => {
    setSelectedDeviceType(deviceType);
    setScreen('scan');
  }, []);

  // Handle scan and pair
  const handleScan = useCallback(async () => {
    if (!selectedDeviceType) return;
    
    setIsScanning(true);
    
    try {
      await bleService.connect();
      
      // Get device info to create paired device entry
      const info = await bleService.getInfo();
      const newDevice: Omit<PairedDevice, 'addedAt'> = {
        id: `device-${Date.now()}`,
        name: selectedDeviceType.name,
        type: selectedDeviceType.type,
      };
      
      deviceStore.addPairedDevice(newDevice);
      deviceStore.setConnected(true);
      deviceStore.setDeviceInfo(info);
      
      // Load the rest of the data
      const [settings, images] = await Promise.all([
        bleService.getSettings(),
        bleService.getImages(),
      ]);
      deviceStore.setSettings(settings);
      deviceStore.setImages(images);
      
      // Switch to device screen
      setSelectedDevice({ ...newDevice, addedAt: Date.now() });
      setScreen('device');
      success('Device paired successfully');
    } catch (err) {
      error('Could not connect. Turn the device OFF then ON.');
      setScreen('select-type');
    } finally {
      setIsScanning(false);
    }
  }, [selectedDeviceType, success, error]);

  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    await bleService.disconnect();
    deviceStore.resetConnection();
  }, []);

  // Handle remove device
  const handleRemoveDevice = useCallback((device: PairedDevice) => {
    deviceStore.removePairedDevice(device.id);
    setShowDeleteModal(null);
    success('Device removed');
  }, [success]);

  // Handle back navigation
  const handleBack = useCallback(async () => {
    if (screen === 'scan') {
      setScreen('select-type');
      setIsScanning(false);
      return;
    }
    
    if (screen === 'select-type') {
      setScreen('devices');
      setSelectedDeviceType(null);
      return;
    }
    
    if (store.isConnected) {
      await bleService.disconnect();
      deviceStore.resetConnection();
    }
    setSelectedDevice(null);
    setScreen('devices');
  }, [screen, store.isConnected]);

  // Not supported screen
  if (!isSupported) {
    return (
      <div className="not-supported">
        <div className="not-supported-icon">
          <BluetoothOff size={36} />
        </div>
        {unsupportedReason === 'secure-context' ? (
          <>
            <h1>HTTPS Required</h1>
            <p>Web Bluetooth requires a secure connection.</p>
            <p style={{ marginTop: '0.5rem' }}>Access the app via:</p>
            <div className="supported-browsers" style={{ marginTop: '0.5rem' }}>
              <Badge variant="secondary">localhost</Badge>
              <Badge variant="secondary">HTTPS</Badge>
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: '1rem', color: 'var(--foreground-subtle)' }}>
              Current: {window.location.protocol}//{window.location.host}
            </p>
          </>
        ) : (
          <>
            <h1>Bluetooth Not Supported</h1>
            <p>Your browser doesn't support Web Bluetooth.</p>
            <p>Please use one of these browsers:</p>
            <div className="supported-browsers">
              <Badge variant="secondary">Chrome</Badge>
              <Badge variant="secondary">Edge</Badge>
              <Badge variant="secondary">Opera</Badge>
            </div>
          </>
        )}
      </div>
    );
  }

  // Device type selection screen
  if (screen === 'select-type') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <button className="header-back" onClick={handleBack}>
                <ChevronLeft size={20} />
              </button>
              <div>
                <div className="header-title">Add Device</div>
                <div className="header-subtitle">Select device type</div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="app-content">
          <div className="device-type-list">
            {DEVICE_TYPES.map((deviceType, index) => (
              <Card 
                key={deviceType.id}
                variant="interactive"
                className={`device-type-card animate-slideUp stagger-${index + 1}`}
                onClick={() => handleSelectDeviceType(deviceType)}
              >
                <div className="device-type-icon">
                  <img src={deviceType.icon} alt={deviceType.name} />
                </div>
                <div className="device-type-info">
                  <div className="device-type-name">{deviceType.name}</div>
                  <div className="device-type-desc">{deviceType.description}</div>
                </div>
                <ChevronRight size={20} className="device-type-chevron" />
              </Card>
            ))}
          </div>
        </main>
        
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  // Scan screen
  if (screen === 'scan' && selectedDeviceType) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <button className="header-back" onClick={handleBack}>
                <ChevronLeft size={20} />
              </button>
              <div>
                <div className="header-title">{selectedDeviceType.name}</div>
                <div className="header-subtitle">Pairing</div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="app-content">
          <div className="scan-screen">
            <div className="scan-device-preview">
              <img src={selectedDeviceType.icon} alt={selectedDeviceType.name} />
            </div>
            
            <div className="scan-hint">
              <AlertTriangle size={20} className="scan-hint-icon" />
              <p>
                Make sure your {selectedDeviceType.name} is powered ON. 
                The device is only discoverable for 10 minutes after powering on.
              </p>
            </div>
            
            {isScanning ? (
              <div className="scanning-indicator">
                <div className="scanning-animation">
                  <Bluetooth size={24} />
                </div>
                <p style={{ color: 'var(--foreground-muted)' }}>Searching for devices...</p>
                <Button variant="ghost" onClick={() => { setIsScanning(false); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={handleScan} className="btn-full" size="lg">
                <Scan size={20} />
                Scan for Device
              </Button>
            )}
          </div>
        </main>
        
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  // Device screen
  if (screen === 'device' && selectedDevice) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <button className="header-back" onClick={handleBack}>
                <ChevronLeft size={20} />
              </button>
              <div>
                <div className="header-title">{selectedDevice.name}</div>
                <div className="header-subtitle">
                  {store.isConnected ? 'Connected' : store.isConnecting ? 'Connecting...' : 'Disconnected'}
                </div>
              </div>
            </div>
            <div className="header-actions">
              <Badge 
                variant={store.isConnected ? 'success' : 'secondary'} 
                dot
              >
                {store.isConnected ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </div>
        </header>
        
        <main className="app-content has-bottom-nav">
          <DeviceScreen
            device={selectedDevice as PairedDevice }
            isConnected={store.isConnected}
            isConnecting={store.isConnecting}
            deviceInfo={store.deviceInfo}
            settings={store.settings}
            images={store.images}
            onConnect={() => handleOpenDevice(selectedDevice)}
            onDisconnect={handleDisconnect}
          />
        </main>
        
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  // Device list screen (default)
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <Bluetooth size={20} style={{ color: 'var(--foreground)' }} />
            <div className="header-title">E-Ink Manager</div>
          </div>
        </div>
      </header>
      
      <main className="app-content">
        {store.pairedDevices.length === 0 ? (
          <div className="empty-state animate-fadeIn">
            <div className="empty-state-icon">
              <img src={eframeIcon} alt="E-Ink Frame" style={{ width: 80, height: 80, objectFit: 'contain' }} />
            </div>
            <h2>No Devices</h2>
            <p>Add your first e-ink photo frame to get started.</p>
            <Button onClick={() => setScreen('select-type')} size="lg">
              <Plus size={20} />
              Add Device
            </Button>
          </div>
        ) : (
          <>
            <div className="device-list-header">
              <h1>My Devices</h1>
              <Button variant="outline" size="sm" onClick={() => setScreen('select-type')}>
                <Plus size={16} />
                Add
              </Button>
            </div>
            
            <div className="device-list">
              {store.pairedDevices.map((device, index) => {
                const deviceTypeInfo = DEVICE_TYPES.find(dt => dt.type === device.type);
                return (
                  <Card 
                    key={device.id} 
                    variant="interactive" 
                    className={`device-card animate-slideUp stagger-${index + 1}`}
                    onClick={() => handleOpenDevice(device)}
                  >
                    <div className="device-icon">
                      {deviceTypeInfo ? (
                        <img src={deviceTypeInfo.icon} alt={device.name} />
                      ) : (
                        <Bluetooth size={24} />
                      )}
                    </div>
                    <div className="device-info">
                      <div className="device-name">{device.name}</div>
                      <div className="device-meta">
                        <span>{deviceTypeInfo?.description || 'E-Ink Frame'}</span>
                        {device.lastConnected && (
                          <>
                            <span>•</span>
                            <span>{formatTimeAgo(device.lastConnected)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button 
                      className="header-back"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteModal(device);
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
      
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Remove Device</div>
              <div className="modal-description">
                Are you sure you want to remove "{showDeleteModal.name}"? You can pair it again later.
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleRemoveDevice(showDeleteModal)}>
                <Trash2 size={16} />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// Helper function
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default App;
