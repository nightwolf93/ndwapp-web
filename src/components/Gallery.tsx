import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  Play,
  Trash2,
  Trash,
} from 'lucide-react';
import { Button } from './ui';
import { Badge } from './ui';
import type { DeviceSettings } from '../services/bleService';

interface GalleryProps {
  images: string[];
  settings: DeviceSettings | null;
  onDisplay: (name: string) => Promise<boolean>;
  onDelete: (name: string) => Promise<boolean>;
  onDeleteAll: () => Promise<boolean>;
  onPrevious: () => Promise<boolean>;
  onNext: () => Promise<boolean>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function Gallery({
  images,
  settings,
  onDisplay,
  onDelete,
  onDeleteAll,
  onPrevious,
  onNext,
  onRefresh,
  isRefreshing,
}: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDisplay = async (name: string) => {
    await onDisplay(name);
    setSelectedImage(null);
  };

  const handleDelete = async (name: string) => {
    setIsDeleting(true);
    await onDelete(name);
    setIsDeleting(false);
    if (selectedImage === name) {
      setSelectedImage(null);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    await onDeleteAll();
    setIsDeleting(false);
    setShowDeleteAllConfirm(false);
    setSelectedImage(null);
  };

  if (images.length === 0) {
    return (
      <div className="gallery-empty">
        <ImageIcon size={48} />
        <p>No images yet</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--foreground-subtle)' }}>
          Upload images to display them
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Navigation controls */}
      <div className="gallery-nav">
        <Button variant="ghost" size="icon" onClick={onPrevious}>
          <ChevronLeft size={20} />
        </Button>
        
        <div className="gallery-nav-info">
          <span className="gallery-nav-current">
            {settings?.current || 'None'}
          </span>
        </div>
        
        <Button variant="ghost" size="icon" onClick={onNext}>
          <ChevronRight size={20} />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteAllConfirm(true)}
          disabled={isDeleting}
        >
          <Trash size={16} />
          Delete All
        </Button>
      </div>

      {/* Image grid */}
      <div className="gallery-grid">
        {images.map((name) => (
          <div
            key={name}
            className={`gallery-item ${selectedImage === name ? 'selected' : ''} ${settings?.current === name ? 'current' : ''}`}
            onClick={() => setSelectedImage(selectedImage === name ? null : name)}
          >
            <div className="gallery-item-placeholder">
              <ImageIcon size={24} />
            </div>
            
            <div className="gallery-item-name">{name}</div>

            {settings?.current === name && (
              <Badge variant="success" size="sm" className="gallery-item-badge">
                Current
              </Badge>
            )}

            {selectedImage === name && (
              <div className="gallery-item-actions">
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDisplay(name);
                  }}
                >
                  <Play size={14} />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(name);
                  }}
                  disabled={isDeleting}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete all confirmation modal */}
      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete All Images</div>
              <div className="modal-description">
                Are you sure you want to delete all {images.length} images? This cannot be undone.
              </div>
            </div>
            <div className="modal-actions">
              <Button
                variant="outline"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAll}
                loading={isDeleting}
              >
                <Trash2 size={16} />
                Delete All
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
