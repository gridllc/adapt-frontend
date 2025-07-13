
import { ObjectDetector, FilesetResolver, Detection } from "@mediapipe/tasks-vision";
import type { DetectedObject } from '@/types';

// Singleton instance of the detector to avoid re-initialization
let objectDetector: ObjectDetector | null = null;
let isInitializing = false;

// URL for the pre-trained model file.
// This is hosted by Google to make it easy to use.
const MODEL_ASSET_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite';
const MIN_DETECTION_CONFIDENCE = 0.5; // Only show objects with > 50% confidence

/**
 * Initializes the MediaPipe ObjectDetector.
 * This function downloads the model and sets up the detector.
 * It's designed to be called once.
 * @returns A promise that resolves when the detector is ready.
 */
export const initializeObjectDetector = async (): Promise<void> => {
    if (objectDetector || isInitializing) {
        return;
    }
    isInitializing = true;
    console.log("Initializing Vision AI...");

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        objectDetector = await ObjectDetector.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: MODEL_ASSET_URL,
                delegate: "GPU", // Use GPU for better performance if available
            },
            scoreThreshold: MIN_DETECTION_CONFIDENCE,
            runningMode: "VIDEO", // Optimized for video streams
            maxResults: 5, // Detect up to 5 objects at a time
        });

        console.log("Vision AI initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Vision AI:", error);
        throw new Error("Could not initialize the real-time vision model. Please try refreshing the page.");
    } finally {
        isInitializing = false;
    }
};

/**
 * Detects objects in a given video frame using the initialized MediaPipe detector.
 * @param videoElement The HTMLVideoElement to analyze.
 * @returns A promise that resolves to an array of detected objects.
 */
export const detectObjectsInVideo = (videoElement: HTMLVideoElement): DetectedObject[] => {
    if (!objectDetector) {
        // This case should be handled by the UI (e.g., disabling features until initialized).
        return [];
    }

    const startTimeMs = performance.now();
    const results = objectDetector.detectForVideo(videoElement, startTimeMs);

    if (!results || results.detections.length === 0) {
        return [];
    }

    // Map MediaPipe's `Detection` type to our application's `DetectedObject` type.
    return results.detections.map((detection: Detection): DetectedObject | null => {
        const category = detection.categories[0];
        const box = detection.boundingBox;

        if (!category || !box) return null;

        // The bounding box needs to be normalized by the video dimensions.
        return {
            label: category.categoryName,
            score: category.score,
            box: [
                box.originX / videoElement.videoWidth,
                box.originY / videoElement.videoHeight,
                (box.originX + box.width) / videoElement.videoWidth,
                (box.originY + box.height) / videoElement.videoHeight,
            ],
        };
    }).filter((obj): obj is DetectedObject => obj !== null);
};
