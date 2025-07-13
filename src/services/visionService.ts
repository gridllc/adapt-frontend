
import type { DetectedObject } from '@/types';

// This is a placeholder for a real object detection model (e.g., MediaPipe, YOLO).
// For this prototype, it returns a mocked list of objects to simulate vision analysis.
// The bounding boxes are represented as [xMin, yMin, xMax, yMax] in percentage coordinates.

const MOCK_DETECTIONS: DetectedObject[] = [
  { label: 'hand', box: [0.15, 0.3, 0.5, 0.85] },
  { label: 'screwdriver', box: [0.45, 0.45, 0.8, 0.55] },
];

let lastDetectionTime = 0;
const DETECTION_INTERVAL = 3000; // Only return new detections every 3 seconds

/**
 * Simulates detecting objects in a given video frame.
 * @param _frame The video frame (as a canvas element) to analyze. Not used in this mock.
 * @returns A promise that resolves to an array of detected objects.
 */
export const detectObjects = async (_frame: HTMLCanvasElement): Promise<DetectedObject[]> => {
  return new Promise((resolve) => {
    // Simulate network latency and processing time for the detection model.
    setTimeout(() => {
        const now = Date.now();
        // To make it feel more dynamic, we'll only return objects periodically.
        if (now - lastDetectionTime > DETECTION_INTERVAL) {
            lastDetectionTime = now;
            resolve(MOCK_DETECTIONS);
        } else {
            resolve([]);
        }
    }, 250);
  });
};
