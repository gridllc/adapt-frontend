import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/apiClient';

interface UseSafeVideoUrlResult {
  videoUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

const BUCKET_NAME = 'training-videos';

/**
 * A hook to securely fetch a temporary signed URL for a video from Supabase storage.
 * It handles loading and error states, and provides a `retry` function to re-attempt fetching the URL.
 * @param path The path to the file within the bucket. Can be null.
 * @returns An object containing the videoUrl, and states for loading, error, and a retry function.
 */
export function useSafeVideoUrl(path: string | null): UseSafeVideoUrlResult {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const loadVideo = useCallback(async () => {
    if (!path) {
        setIsLoading(false);
        setIsError(true); // No path is an error state
        return;
    }

    setIsLoading(true);
    setIsError(false);
    setVideoUrl(null);

    try {
        // Create a temporary URL that's valid for 5 minutes.
        const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, 300);

        if (error) {
            throw error;
        }

        if (data?.signedUrl) {
            setVideoUrl(data.signedUrl);
        } else {
            // This case should not happen if error is null, but it's a safeguard.
            throw new Error("createSignedUrl returned no URL and no error.");
        }
    } catch (err) {
        console.error("Failed to get signed video URL:", err);
        setIsError(true);
    } finally {
        setIsLoading(false);
    }
  }, [path]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  return {
    videoUrl,
    isLoading,
    isError,
    retry: loadVideo,
  };
}
