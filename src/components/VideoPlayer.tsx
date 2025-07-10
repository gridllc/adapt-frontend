import React, { forwardRef } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  onTimeUpdate: (time: number) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({ videoUrl, onTimeUpdate }, ref) => {
  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    onTimeUpdate(event.currentTarget.currentTime);
  };

  return (
    <video
      ref={ref}
      src={videoUrl}
      controls
      onTimeUpdate={handleTimeUpdate}
      className="w-full h-full object-cover"
      playsInline
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';
