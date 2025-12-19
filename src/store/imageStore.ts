import { create } from 'zustand';
import type { ImageFile, ImageStore } from '@/types';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

export const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  
  addImage: (image: ImageFile) => {
    set((state) => ({
      images: [...state.images, image],
    }));
  },
  
  addImages: (images: ImageFile[]) => {
    set((state) => ({
      images: [...state.images, ...images],
    }));
  },
  
  updateImage: (id: string, updates: Partial<ImageFile>) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    }));
  },
  
  removeImage: (id: string) => {
    const image = get().images.find((img) => img.id === id);
    if (image?.previewUrl) {
      URL.revokeObjectURL(image.previewUrl);
    }
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
    }));
  },
  
  clearImages: () => {
    const { images } = get();
    images.forEach((img) => {
      if (img.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
      }
    });
    set({ images: [] });
  },
  
  getImage: (id: string) => {
    return get().images.find((img) => img.id === id);
  },
  
  uploadFiles: async (files: File[]) => {
    const { addImage, updateImage } = get();
    
    // Create placeholder entries for each file
    const newImages: ImageFile[] = files.map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      format: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
      width: 0,
      height: 0,
      previewUrl: URL.createObjectURL(file),
      uploadedAt: new Date(),
      uploading: true,
    }));
    
    // Add images to store immediately (with uploading state)
    newImages.forEach((img) => addImage(img));
    
    // Load dimensions client-side
    for (const img of newImages) {
      if (!['svg', 'pdf'].includes(img.format)) {
        const image = new Image();
        image.onload = () => {
          updateImage(img.id, { width: image.width, height: image.height });
        };
        image.src = img.previewUrl;
      }
    }
    
    // Upload to server
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Match server responses to our images by filename
        for (const serverData of result.data) {
          const matchingImage = newImages.find(
            (img) => img.name === serverData.name
          );
          if (matchingImage) {
            updateImage(matchingImage.id, {
              width: serverData.width || matchingImage.width,
              height: serverData.height || matchingImage.height,
              format: serverData.format,
              serverFilename: serverData.filepath,
              formatSizes: serverData.formatSizes,
              uploading: false,
            });
          }
        }
      } else {
        // Mark all as failed
        newImages.forEach((img) => {
          updateImage(img.id, { uploading: false, error: 'Upload failed' });
        });
      }
    } catch (error) {
      // Server-side error logging is fine, but we'll mark images as failed
      newImages.forEach((img) => {
        updateImage(img.id, { uploading: false, error: 'Upload failed' });
      });
    }
  },
}));

