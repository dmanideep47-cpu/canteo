import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export default function SafeImage({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-video',
  fallbackText = 'Image unavailable',
  priority = false,
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError || !src) {
    return (
      <div
        className={`w-full ${aspectRatio} bg-[#F4EFEA] border border-[#E5E2DD] rounded-xl flex flex-col items-center justify-center p-4 text-center select-none ${className}`}
        role="img"
        aria-label={alt || fallbackText}
      >
        <ImageOff className="w-5 h-5 text-[#8C8C8C] mb-1.5 stroke-[1.5]" />
        <span className="text-xs font-normal text-[#6B6B6B] font-body truncate max-w-full">
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-[#F4EFEA] ${aspectRatio} ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-[#F4EFEA] animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
}
