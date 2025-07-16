
import { ObjectDetector, FilesetResolver, Detection } from "@mediapipe/tasks-vision";
import type { DetectedObject } from '@/types';

// Singleton instance of the detector to avoid re-initialization
let objectDetector: ObjectDetector | null = null;
let isInitializing = false;

// URL for the pre-trained model file from Google's CDN.
const MODEL_ASSET_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite';
const MIN_DETECTION_CONFIDENCE = 0.5; // Only show objects with > 50% confidence

// --- Synonym Mapping ---
/**
 * A map of common object names to a list of their synonyms.
 * This helps the vision system match detected objects even if the model's label
 * doesn't perfectly match the required object name in the module's "needs".
 * For example, if a step requires a "reader", this map allows the system to also
 * accept a detected "card reader" or "scanner".
 */
const synonymMap: Record<string, string[]> = {
    reader: ['card reader', 'credit terminal', 'scanner'],
    button: ['power button', 'reset button'],
    cable: ['charging cable', 'usb cord'],
    knife: ['utility knife', 'box cutter'],
    pot: ['saucepan'],
    bread: ['toast'],
};


/**
 * Initializes the MediaPipe ObjectDetector.
 * This function downloads the model and sets up the detector.
 * It's designed to be called once, as it's a heavy operation.
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
 * This function returns rich metadata for each detected object, including its label,
 * confidence score, and bounding box coordinates.
 * 
 * Note: Debouncing of detection events is handled by the consumer of this service
 * (e.g., LiveCoachPage), as the desired behavior (like offering a hint vs. advancing a step)
 * is context-dependent and requires more than a simple time-based debounce.
 * 
 * @param videoElement The HTMLVideoElement to analyze.
 * @returns An array of detected objects.
 */
export const detectObjectsInVideo = (videoElement: HTMLVideoElement): DetectedObject[] => {
    if (!objectDetector) {
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

/**
 * Checks if a specific object (or its synonym) is present in a list of detected objects.
 * This is the primary function for matching step requirements against the camera feed.
 * @param detectedObjects The array of objects detected in the video frame.
 * @param targetObject The name of the object to look for (e.g., "reader").
 * @returns True if a match is found, otherwise false.
 */
export const isObjectPresent = (detectedObjects: DetectedObject[], targetObject: string): boolean => {
    if (!targetObject) return false;

    const target = targetObject.toLowerCase();
    const possibleLabels = [target, ...(synonymMap[target] || [])];

    return detectedObjects.some(detected =>
        possibleLabels.some(label => detected.label.toLowerCase().includes(label))
    );
};
