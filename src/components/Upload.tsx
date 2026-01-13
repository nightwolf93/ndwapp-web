import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload as UploadIcon,
  X,
  Save,
  Play,
  Monitor,
  Smartphone,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui';
import { Input } from './ui';
import { Progress } from './ui';
import {
  loadImage,
  processImage,
  sanitizeFilename,
  formatBytes,
  BUFFER_SIZE,
} from '../utils/imageProcessor';
import type { ColorMode, Orientation, ProcessedImage } from '../utils/imageProcessor';

interface UploadError {
  message: string;
  progress: number;
  timestamp: number;
}

interface UploadProps {
  onUpload: (name: string, data: Uint8Array, onProgress: (sent: number, total: number) => void) => Promise<boolean>;
  onUploadAndDisplay: (name: string, data: Uint8Array, onProgress: (sent: number, total: number) => void) => Promise<boolean>;
  uploadError?: UploadError | null;
  onClearError?: () => void;
}

export function Upload({ onUpload, onUploadAndDisplay, uploadError, onClearError }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [imageName, setImageName] = useState('');
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Process image when settings change
  useEffect(() => {
    if (loadedImage) {
      const processed = processImage(loadedImage, colorMode, orientation);
      setProcessedImage(processed);

      // Draw preview
      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        if (ctx) {
          previewCanvasRef.current.width = processed.previewCanvas.width;
          previewCanvasRef.current.height = processed.previewCanvas.height;
          ctx.drawImage(processed.previewCanvas, 0, 0);
        }
      }
    }
  }, [loadedImage, colorMode, orientation]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError(null);

    try {
      const img = await loadImage(file);
      setLoadedImage(img);
      setImageName(sanitizeFilename(file.name));
    } catch {
      setError('Failed to load image');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const handleUpload = async (displayAfter: boolean) => {
    if (!processedImage || !imageName.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    const onProgress = (sent: number, total: number) => {
      setUploadProgress(Math.round((sent / (total || BUFFER_SIZE)) * 100));
    };

    try {
      const uploadFn = displayAfter ? onUploadAndDisplay : onUpload;
      const success = await uploadFn(imageName.trim(), processedImage.binaryData, onProgress);

      if (success) {
        // Reset form
        setLoadedImage(null);
        setProcessedImage(null);
        setImageName('');
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError('Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setLoadedImage(null);
    setProcessedImage(null);
    setImageName('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drop zone
  if (!loadedImage) {
    return (
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          hidden
        />
        <UploadIcon size={48} />
        <span className="upload-dropzone-text">Drop image here</span>
        <span className="upload-dropzone-hint">or click to select</span>
      </div>
    );
  }

  // Preview and options
  return (
    <div className="upload-preview">
      {/* Preview canvas */}
      <div className="upload-preview-image">
        <canvas
          ref={previewCanvasRef}
          style={{
            maxWidth: '100%',
            maxHeight: orientation === 'horizontal' ? '200px' : '300px',
          }}
        />
      </div>

      {/* Options */}
      <div className="upload-options">
        {/* Orientation */}
        <div className="upload-option-group">
          <label>Orientation</label>
          <div className="upload-option-buttons">
            <Button
              variant={orientation === 'horizontal' ? 'default' : 'outline'}
              onClick={() => setOrientation('horizontal')}
              disabled={isUploading}
            >
              <Monitor size={16} />
              Landscape
            </Button>
            <Button
              variant={orientation === 'vertical' ? 'default' : 'outline'}
              onClick={() => setOrientation('vertical')}
              disabled={isUploading}
            >
              <Smartphone size={16} />
              Portrait
            </Button>
          </div>
        </div>

        {/* Color mode */}
        <div className="upload-option-group">
          <label>Color Mode</label>
          <div className="upload-option-buttons">
            <Button
              variant={colorMode === 'color' ? 'default' : 'outline'}
              onClick={() => setColorMode('color')}
              disabled={isUploading}
            >
              4 Colors
            </Button>
            <Button
              variant={colorMode === 'bw' ? 'default' : 'outline'}
              onClick={() => setColorMode('bw')}
              disabled={isUploading}
            >
              B&W
            </Button>
          </div>
        </div>

        {/* Image name */}
        <Input
          label="Image Name"
          value={imageName}
          onChange={(e) => setImageName(sanitizeFilename(e.target.value))}
          placeholder="my_image"
          maxLength={24}
          disabled={isUploading}
        />
      </div>

      {/* Info */}
      <p style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)', textAlign: 'center' }}>
        {orientation === 'horizontal' ? '800 × 480' : '480 × 800'} px • {formatBytes(BUFFER_SIZE)}
      </p>

      {/* Upload Error Banner (from failed upload) */}
      {uploadError && (
        <div className="upload-error-banner">
          <div className="upload-error-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="upload-error-content">
            <div className="upload-error-title">{uploadError.message}</div>
            <div className="upload-error-detail">
              Upload stopped at {uploadError.progress}%
            </div>
          </div>
          {onClearError && (
            <button className="upload-error-close" onClick={onClearError}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Local Error */}
      {error && (
        <div style={{ 
          padding: '0.75rem 1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius)',
          color: 'var(--destructive)',
          fontSize: '0.875rem',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Progress */}
      {isUploading && (
        <Progress value={uploadProgress} showValue />
      )}

      {/* Actions */}
      <div className="upload-actions">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isUploading}
        >
          <X size={16} />
          Cancel
        </Button>
        <Button
          onClick={() => handleUpload(false)}
          disabled={isUploading || !imageName.trim()}
          loading={isUploading}
        >
          <Save size={16} />
          Save
        </Button>
        <Button
          variant="success"
          onClick={() => handleUpload(true)}
          disabled={isUploading || !imageName.trim()}
          loading={isUploading}
        >
          <Play size={16} />
          Save & Display
        </Button>
      </div>
    </div>
  );
}
