
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

interface VideoPlayerProps {
    videoUrl: string;
    onTimeUpdate: (time: number) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({ videoUrl, onTimeUpdate }, ref) => {
    const localRef = useRef<HTMLVideoElement>(null);

    // Expose the video element ref to the parent component
    useImperativeHandle(ref, () => localRef.current as HTMLVideoElement);

    useEffect(() => {
        const videoElement = localRef.current;
        if (!videoElement) return;

        const handleTimeUpdate = () => {
            onTimeUpdate(videoElement.currentTime);
        };

        videoElement.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [onTimeUpdate]);

    return (
        <div className="w-full aspect-video bg-black">
            <video
                ref={localRef}
                controls
                className="w-full h-full"
                src={videoUrl}
                preload="metadata"
            >
                Your browser does not support the video tag.
            </video>
        </div>
    );
});

VideoPlayer.displayName = 'VideoPlayer';