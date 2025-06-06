import { useState, useEffect, useCallback } from 'react';

interface BackgroundImage {
  url: string;
  alt: string;
}

/**
 * Custom hook for managing a background image slider
 * @param images Array of background images to display
 * @param interval Time in milliseconds between image transitions
 * @returns Object containing current state
 */
export const useBackgroundSlider = (images: BackgroundImage[], interval: number = 10000) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [shuffledImages, setShuffledImages] = useState<BackgroundImage[]>([]);

  // Shuffle function with type safety
  const shuffleArray = useCallback((array: BackgroundImage[]): BackgroundImage[] => {
    if (!array.length) return [];
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }, []);

  // Shuffle images on mount or when images prop changes
  useEffect(() => {
    if (images.length > 0) {
      setShuffledImages(shuffleArray(images));
    }
  }, [images, shuffleArray]);

  // Auto-rotate images
  useEffect(() => {
    if (shuffledImages.length === 0) return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % shuffledImages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [shuffledImages.length, interval]);

  // Ensure we always have a valid current image
  const currentImage = shuffledImages.length > 0 
    ? shuffledImages[currentImageIndex] 
    : images[0] || { url: '', alt: '' };

  return {
    currentImageIndex,
    currentImage
  };
};
