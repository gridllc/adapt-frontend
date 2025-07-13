
import React, { forwardRef, useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { VideoIcon } from './Icons';
import type { DetectedObject } from '@/types';
import { DetectionOverlay } from './DetectionOverlay';

interface LiveCameraFeedProps {
    instruction: string;
    onClick: () => void;
    detectedObjects: DetectedObject[];
}

// Convert the component to use forwardRef to expose the video element's ref
export const LiveCameraFeed = forwardRef<HTMLVideoElement, LiveCameraFeedProps>(
    ({ instruction, onClick, detectedObjects }, ref) => {
        const [error, setError] = useState<string | null>(null);
        const { addToast } = useToast();

        useEffect(() => {
            let stream: MediaStream | null = null;

            const startCamera = async () => {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error("Camera access is not supported by your browser.");
                    }
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment" },
                        audio: false,
                    });

                    if (ref && 'current' in ref && ref.current) {
                        ref.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    let message = "Could not access the camera. Please check your browser permissions.";
                    if (err instanceof DOMException) {
                        if (err.name === "NotAllowedError") {
                            message = "Camera access was denied. Please grant permission in your browser settings.";
                        } else if (err.name === "NotFoundError") {
                            message = "No camera was found on your device.";
                        }
                    }
                    setError(message);
                    addToast('error', "Camera Error", message);
                }
            };

            startCamera();

            return () => {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
            };
        }, [addToast, ref]);

        return (
            <div
                className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-2xl border-4 border-slate-700 cursor-pointer"
                onClick={onClick}
            >
                <video
                    ref={ref}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }} // Mirror the video for a more natural feel
                />

                {/* Render the object detection overlay */}
                <DetectionOverlay detectedObjects={detectedObjects} />

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
                        <VideoIcon className="h-16 w-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold">Camera Error</h3>
                        <p className="text-center mt-2">{error}</p>
                    </div>
                )}

                {/* Instruction Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/60 backdrop-blur-md">
                    <p className="text-white text-lg font-bold text-center drop-shadow-lg animate-fade-in-up">
                        {instruction}
                    </p>
                </div>
            </div>
        );
    }
);

LiveCameraFeed.displayName = 'LiveCameraFeed';
