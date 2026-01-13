// BLE Service for E-Paper Photo Frame
// Matches the UUIDs and commands from ble_server.h

// BLE UUIDs (must match ESP32 firmware)
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const CHAR_COMMAND_UUID = '12345678-1234-1234-1234-123456789001';
const CHAR_RESPONSE_UUID = '12345678-1234-1234-1234-123456789002';
const CHAR_IMAGE_DATA_UUID = '12345678-1234-1234-1234-123456789003';
const CHAR_IMAGE_CONTROL_UUID = '12345678-1234-1234-1234-123456789004';

// Commands
export const CMD = {
  GET_INFO: 0x01,
  GET_IMAGES: 0x02,
  DISPLAY_IMAGE: 0x03,
  NEXT_IMAGE: 0x04,
  PREV_IMAGE: 0x05,
  DELETE_IMAGE: 0x06,
  DELETE_ALL: 0x07,
  START_UPLOAD: 0x10,
  UPLOAD_CHUNK: 0x11,
  FINISH_UPLOAD: 0x12,
  CANCEL_UPLOAD: 0x13,
  GET_SETTINGS: 0x20,
  SET_SLIDESHOW: 0x21,
  SET_INTERVAL: 0x22,
  RESTART: 0x30,
  SLEEP_NOW: 0x31,
} as const;

// Response codes
export const RESP = {
  OK: 0x00,
  ERROR: 0x01,
  INFO: 0x02,
  IMAGE_LIST: 0x03,
  SETTINGS: 0x04,
  PROGRESS: 0x05,
} as const;

// Device info interface
export interface DeviceInfo {
  total: number;
  used: number;
  free: number;
  images: number;
  max: number;
  width: number;
  height: number;
}

// Settings interface
export interface DeviceSettings {
  slideshow: boolean;
  interval: number;
  random: boolean;
  current: string;
}

// Upload progress callback
export type ProgressCallback = (sent: number, total: number) => void;

// Connection state callback
export type ConnectionCallback = (connected: boolean) => void;

class BLEService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
  private responseChar: BluetoothRemoteGATTCharacteristic | null = null;
  private imageDataChar: BluetoothRemoteGATTCharacteristic | null = null;
  // @ts-ignore - Reserved for future use
  private _imageControlChar: BluetoothRemoteGATTCharacteristic | null = null;

  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private responseResolver: ((value: DataView) => void) | null = null;
  private progressCallback: ProgressCallback | null = null;

  // GATT operation queue to prevent "GATT operation already in progress" errors
  private operationQueue: Promise<unknown> = Promise.resolve();
  private isOperationInProgress = false;

  // Check if Web Bluetooth is supported
  isSupported(): boolean {
    // Web Bluetooth requires secure context (HTTPS or localhost)
    const isSecureContext = window.isSecureContext;
    const hasBluetoothApi = 'bluetooth' in navigator;
    return isSecureContext && hasBluetoothApi;
  }

  // Check why Bluetooth is not supported
  getUnsupportedReason(): string {
    if (!window.isSecureContext) {
      return 'secure-context';
    }
    if (!('bluetooth' in navigator)) {
      return 'no-api';
    }
    return 'unknown';
  }

  // Check if currently connected
  isConnected(): boolean {
    return this.server?.connected ?? false;
  }

  // Check if a GATT operation is currently in progress
  isBusy(): boolean {
    return this.isOperationInProgress;
  }

  // Add connection state listener
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionCallbacks.forEach(cb => cb(connected));
  }

  // Connect to the device
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser');
    }

    try {
      // Request device with the e-paper service
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        console.log('[BLE] Device disconnected');
        this.notifyConnectionChange(false);
      });

      // Connect to GATT server
      this.server = await this.device.gatt!.connect();
      console.log('[BLE] Connected to GATT server');

      // Get the service
      const service = await this.server.getPrimaryService(SERVICE_UUID);
      console.log('[BLE] Got service');

      // Get characteristics
      this.commandChar = await service.getCharacteristic(CHAR_COMMAND_UUID);
      this.responseChar = await service.getCharacteristic(CHAR_RESPONSE_UUID);
      this.imageDataChar = await service.getCharacteristic(CHAR_IMAGE_DATA_UUID);
      this._imageControlChar = await service.getCharacteristic(CHAR_IMAGE_CONTROL_UUID);

      // Subscribe to response notifications
      await this.responseChar.startNotifications();
      this.responseChar.addEventListener('characteristicvaluechanged', this.handleResponse.bind(this));

      console.log('[BLE] All characteristics ready');
      this.notifyConnectionChange(true);
      return true;
    } catch (error) {
      console.error('[BLE] Connection error:', error);
      throw error;
    }
  }

  // Disconnect from the device
  async disconnect(): Promise<void> {
    if (this.responseChar) {
      try {
        await this.responseChar.stopNotifications();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    if (this.server?.connected) {
      this.server.disconnect();
    }

    this.device = null;
    this.server = null;
    this.commandChar = null;
    this.responseChar = null;
    this.imageDataChar = null;
    this._imageControlChar = null;
    this.notifyConnectionChange(false);
  }

  // Handle response notifications
  private handleResponse(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;

    if (!value || value.byteLength === 0) return;

    const code = value.getUint8(0);

    // Handle progress updates during upload
    if (code === RESP.PROGRESS && this.progressCallback) {
      const offset = (value.getUint8(1) << 16) | (value.getUint8(2) << 8) | value.getUint8(3);
      this.progressCallback(offset, 0); // Total will be tracked externally
      return;
    }

    // Resolve pending command response
    if (this.responseResolver) {
      this.responseResolver(value);
      this.responseResolver = null;
    }
  }

  // Queue a GATT operation to ensure only one runs at a time
  private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    // Chain the operation to the queue
    const result = this.operationQueue.then(async () => {
      this.isOperationInProgress = true;
      try {
        return await operation();
      } finally {
        this.isOperationInProgress = false;
      }
    });
    
    // Update the queue to wait for this operation (ignore errors for queue chaining)
    this.operationQueue = result.catch(() => {});
    
    return result;
  }

  // Send command and wait for response (internal, not queued)
  private async sendCommandInternal(cmd: number, param?: string): Promise<DataView> {
    if (!this.commandChar) {
      throw new Error('Not connected');
    }

    // Build command buffer
    const encoder = new TextEncoder();
    const paramBytes = param ? encoder.encode(param) : new Uint8Array(0);
    const buffer = new Uint8Array(1 + paramBytes.length);
    buffer[0] = cmd;
    buffer.set(paramBytes, 1);

    // Create promise for response
    const responsePromise = new Promise<DataView>((resolve, reject) => {
      this.responseResolver = resolve;
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.responseResolver) {
          this.responseResolver = null;
          reject(new Error('Command timeout'));
        }
      }, 10000);
    });

    // Send command
    await this.commandChar.writeValue(buffer);

    return responsePromise;
  }

  // Send command and wait for response (queued to prevent GATT conflicts)
  private async sendCommand(cmd: number, param?: string): Promise<DataView> {
    return this.queueOperation(() => this.sendCommandInternal(cmd, param));
  }

  // Parse JSON-like response string
  private parseResponse(data: DataView, offset: number = 1): string {
    const decoder = new TextDecoder();
    const bytes = new Uint8Array(data.buffer, offset);
    return decoder.decode(bytes);
  }

  // ==================== Public API ====================

  // Get device info
  async getInfo(): Promise<DeviceInfo> {
    const response = await this.sendCommand(CMD.GET_INFO);

    if (response.getUint8(0) !== RESP.INFO) {
      throw new Error('Unexpected response');
    }

    const jsonStr = this.parseResponse(response);
    return JSON.parse(jsonStr);
  }

  // Get list of images
  async getImages(): Promise<string[]> {
    const response = await this.sendCommand(CMD.GET_IMAGES);

    if (response.getUint8(0) !== RESP.IMAGE_LIST) {
      throw new Error('Unexpected response');
    }

    const listStr = this.parseResponse(response);
    if (listStr.length === 0) return [];
    return listStr.split('\n').filter(name => name.length > 0);
  }

  // Display a specific image
  async displayImage(name: string): Promise<boolean> {
    const response = await this.sendCommand(CMD.DISPLAY_IMAGE, name);
    return response.getUint8(0) === RESP.OK;
  }

  // Display next image
  async nextImage(): Promise<boolean> {
    const response = await this.sendCommand(CMD.NEXT_IMAGE);
    return response.getUint8(0) === RESP.OK;
  }

  // Display previous image
  async previousImage(): Promise<boolean> {
    const response = await this.sendCommand(CMD.PREV_IMAGE);
    return response.getUint8(0) === RESP.OK;
  }

  // Delete an image
  async deleteImage(name: string): Promise<boolean> {
    const response = await this.sendCommand(CMD.DELETE_IMAGE, name);
    return response.getUint8(0) === RESP.OK;
  }

  // Delete all images
  async deleteAllImages(): Promise<boolean> {
    const response = await this.sendCommand(CMD.DELETE_ALL);
    return response.getUint8(0) === RESP.OK;
  }

  // Get settings
  async getSettings(): Promise<DeviceSettings> {
    const response = await this.sendCommand(CMD.GET_SETTINGS);

    if (response.getUint8(0) !== RESP.SETTINGS) {
      throw new Error('Unexpected response');
    }

    const jsonStr = this.parseResponse(response);
    const data = JSON.parse(jsonStr);
    return {
      slideshow: data.slideshow === 1 || data.slideshow === '1',
      interval: parseInt(data.interval),
      random: data.random === 1 || data.random === '1',
      current: data.current || '',
    };
  }

  // Set slideshow enabled/disabled
  async setSlideshow(enabled: boolean): Promise<boolean> {
    const response = await this.sendCommand(CMD.SET_SLIDESHOW, enabled ? '1' : '0');
    return response.getUint8(0) === RESP.OK;
  }

  // Set slideshow interval (in minutes)
  async setInterval(minutes: number): Promise<boolean> {
    const response = await this.sendCommand(CMD.SET_INTERVAL, minutes.toString());
    return response.getUint8(0) === RESP.OK;
  }

  // Restart device
  async restart(): Promise<boolean> {
    const response = await this.sendCommand(CMD.RESTART);
    return response.getUint8(0) === RESP.OK;
  }

  // Enter deep sleep
  async sleep(): Promise<boolean> {
    const response = await this.sendCommand(CMD.SLEEP_NOW);
    return response.getUint8(0) === RESP.OK;
  }

  // Upload image data
  async uploadImage(
    name: string,
    data: Uint8Array,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    if (!this.imageDataChar) {
      throw new Error('Not connected');
    }

    // Queue the entire upload operation to prevent GATT conflicts
    return this.queueOperation(async () => {
      this.progressCallback = onProgress || null;

      try {
        // Start upload (use internal method since we're already in the queue)
        const startResponse = await this.sendCommandInternal(CMD.START_UPLOAD, name);
        if (startResponse.getUint8(0) !== RESP.OK) {
          throw new Error('Failed to start upload');
        }

        // Send data in chunks using writeValue (with response) for reliable transfer
        // The ESP32 will acknowledge each chunk before we send the next
        const CHUNK_SIZE = 256; // Reasonable size with acknowledgment
        const MAX_RETRIES = 3;
        let offset = 0;

        console.log(`[BLE] Starting upload: ${data.length} bytes in ${Math.ceil(data.length / CHUNK_SIZE)} chunks`);

        while (offset < data.length) {
          const chunk = data.slice(offset, offset + CHUNK_SIZE);
          
          // Retry logic for failed writes
          let retries = 0;
          let success = false;
          
          while (retries < MAX_RETRIES && !success) {
            try {
              // writeValue waits for acknowledgment from ESP32 - much more reliable
              await this.imageDataChar!.writeValue(chunk);
              success = true;
            } catch (writeError) {
              retries++;
              console.log(`[BLE] Chunk write failed at offset ${offset}, retry ${retries}/${MAX_RETRIES}:`, writeError);
              
              if (retries >= MAX_RETRIES) {
                console.log(`[BLE] Upload failed after ${MAX_RETRIES} retries at offset ${offset}`);
                throw writeError;
              }
              
              // Wait before retry
              const waitTime = 300 * retries;
              console.log(`[BLE] Waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
          
          offset += chunk.length;

          if (onProgress) {
            onProgress(offset, data.length);
          }

          // Small delay between chunks to avoid overwhelming the ESP32
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`[BLE] Upload data sent: ${offset} bytes`);


        // Small delay before finishing to let device process last chunks
        await new Promise(resolve => setTimeout(resolve, 100));

        // Finish upload (use internal method since we're already in the queue)
        const finishResponse = await this.sendCommandInternal(CMD.FINISH_UPLOAD);
        return finishResponse.getUint8(0) === RESP.OK;
      } catch (error) {
        // Cancel upload on error
        try {
          await this.sendCommandInternal(CMD.CANCEL_UPLOAD);
        } catch (e) {
          // Ignore cancel errors
        }
        throw error;
      } finally {
        this.progressCallback = null;
      }
    });
  }

  // Cancel ongoing upload
  async cancelUpload(): Promise<boolean> {
    // Use queueOperation to properly wait for any ongoing operation
    return this.queueOperation(async () => {
      const response = await this.sendCommandInternal(CMD.CANCEL_UPLOAD);
      return response.getUint8(0) === RESP.OK;
    });
  }
}

// Export singleton instance
export const bleService = new BLEService();
export default bleService;
