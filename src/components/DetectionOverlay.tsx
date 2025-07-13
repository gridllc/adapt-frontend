
import React from 'react';
import type { DetectedObject } from '@/types';

interface DetectionOverlayProps {
    detectedObjects: DetectedObject[];
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({ detectedObjects }) => {
    if (detectedObjects.length === 0) {
        return null;
    }

    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none">
            {detectedObjects.map((obj, index) => {
                const [xMin, yMin, xMax, yMax] = obj.box;
                const style: React.CSSProperties = {
                    position: 'absolute',
                    left: `${xMin * 100}%`,
                    top: `${yMin * 100}%`,
                    width: `${(xMax - xMin) * 100}%`,
                    height: `${(yMax - yMin) * 100}%`,
                    // The video feed is mirrored, so we must mirror the overlay as well
                    transform: 'scaleX(-1)',
                };

                const scoreText = obj.score ? `(${(obj.score * 100).toFixed(0)}%)` : '';

                return (
                    <div key={index} style={style} className="border-2 border-green-400 rounded-md animate-fade-in-up flex justify-center items-start">
                        <span className="bg-green-400 text-slate-900 text-xs font-bold px-2 py-0.5 rounded -translate-y-full">
                            {obj.label} {scoreText}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};