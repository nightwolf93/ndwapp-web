import { useState } from 'react';
import {
  RotateCcw,
  Moon,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from './ui';
import { Switch } from './ui';
import { Progress } from './ui';
import type { DeviceInfo, DeviceSettings } from '../services/bleService';

interface SettingsProps {
  settings: DeviceSettings | null;
  deviceInfo: DeviceInfo | null;
  onSetSlideshow: (enabled: boolean) => Promise<boolean>;
  onSetInterval: (minutes: number) => Promise<boolean>;
  onRestart: () => Promise<boolean>;
  onSleep: () => Promise<boolean>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function Settings({
  settings,
  deviceInfo,
  onSetSlideshow,
  onSetInterval,
  onRestart,
  onSleep,
}: SettingsProps) {
  const [interval, setInterval] = useState(settings?.interval || 60);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleIntervalChange = async (newInterval: number) => {
    if (newInterval < 1 || newInterval > 1440) return;
    setInterval(newInterval);
  };

  const handleIntervalCommit = async () => {
    if (interval === settings?.interval) return;
    setIsUpdating(true);
    await onSetInterval(interval);
    setIsUpdating(false);
  };

  const handleSlideshowToggle = async () => {
    if (!settings) return;
    setIsUpdating(true);
    await onSetSlideshow(!settings.slideshow);
    setIsUpdating(false);
  };

  const storagePercent = deviceInfo 
    ? (deviceInfo.used / deviceInfo.total) * 100 
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Storage */}
      <div className="settings-section">
        <div className="settings-section-title">Storage</div>
        <div className="settings-card">
          <div className="storage-info">
            <div className="storage-stat">
              <span className="storage-stat-label">Used</span>
              <span className="storage-stat-value">
                {deviceInfo ? formatBytes(deviceInfo.used) : '-'}
              </span>
            </div>
            <div className="storage-stat">
              <span className="storage-stat-label">Total</span>
              <span className="storage-stat-value">
                {deviceInfo ? formatBytes(deviceInfo.total) : '-'}
              </span>
            </div>
            <div className="storage-stat">
              <span className="storage-stat-label">Images</span>
              <span className="storage-stat-value">
                {deviceInfo ? deviceInfo.images : '-'}
              </span>
            </div>
            <div className="storage-stat">
              <span className="storage-stat-label">Max Images</span>
              <span className="storage-stat-value">
                {deviceInfo ? deviceInfo.max : '-'}
              </span>
            </div>
            <div className="storage-bar">
              <Progress value={storagePercent} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Slideshow */}
      <div className="settings-section">
        <div className="settings-section-title">Slideshow</div>
        <div className="settings-card">
          <div className="settings-item">
            <Switch
              label="Enable Slideshow"
              description="Automatically cycle through images"
              checked={settings?.slideshow || false}
              onChange={handleSlideshowToggle}
              disabled={isUpdating || !settings}
            />
          </div>
          
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Interval</span>
              <span className="settings-item-desc">Time between image changes</span>
            </div>
            <div className="interval-control">
              <Button
                variant="outline"
                size="icon"
                className="btn-sm"
                onClick={() => handleIntervalChange(interval - 5)}
                disabled={interval <= 1 || isUpdating}
              >
                <Minus size={14} />
              </Button>
              <span className="interval-value">{interval} min</span>
              <Button
                variant="outline"
                size="icon"
                className="btn-sm"
                onClick={() => handleIntervalChange(interval + 5)}
                disabled={interval >= 1440 || isUpdating}
              >
                <Plus size={14} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleIntervalCommit}
                disabled={interval === settings?.interval || isUpdating}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Display Info */}
      <div className="settings-section">
        <div className="settings-section-title">Display</div>
        <div className="settings-card">
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Resolution</span>
            </div>
            <span className="settings-item-value">
              {deviceInfo ? `${deviceInfo.width} × ${deviceInfo.height}` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Device Actions */}
      <div className="settings-section">
        <div className="settings-section-title">Device</div>
        <div className="danger-zone">
          <Button
            variant="outline"
            onClick={onRestart}
            className="btn-full"
          >
            <RotateCcw size={16} />
            Restart Device
          </Button>
          <Button
            variant="outline"
            onClick={onSleep}
            className="btn-full"
          >
            <Moon size={16} />
            Enter Sleep Mode
          </Button>
        </div>
      </div>
    </div>
  );
}
