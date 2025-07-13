
import React, { useRef, useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { VideoIcon } from './Icons';

interface LiveCameraFeedProps {
    instruction: string;
}

export const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({ instruction }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
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
                    video: { facingMode: "environment" }, // Prefer rear camera
                    audio: false 
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
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

        // Cleanup function to stop the stream when the component unmounts
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [addToast]);

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-2xl border-4 border-slate-700">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror the video for a more natural feel
            />
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

             {/* TODO: This is where bounding boxes from a real object detection model would be rendered.
                 For example:
                 <div style={{ position: 'absolute', top: '20%', left: '30%', width: '40%', height: '50%', border: '2px solid #34D399', color: 'white', ... }}>
                    Hand
                 </div>
             */}
        </div>
    );
};
