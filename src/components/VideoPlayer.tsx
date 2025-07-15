import React, { forwardRef } from 'react';

interface VideoPlayerProps {
  video_url: string | null;
  onTimeUpdate: (time: number) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({ video_url, onTimeUpdate }, ref) => {
  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    onTimeUpdate(event.currentTarget.currentTime);
  };

  if (!video_url) return null;

  return (
    <video
      ref={ref}
      src={video_url}
      controls
      onTimeUpdate={handleTimeUpdate}
      className="w-full h-full object-cover"
      playsInline
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';