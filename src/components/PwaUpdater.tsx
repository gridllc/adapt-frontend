
import { useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';

/**
 * A headless React component to manage the service worker lifecycle for PWA functionality.
 * It handles registration, update detection, and user notifications for new versions.
 */
export const PwaUpdater: React.FC = () => {
    const { addToast } = useToast();

    useEffect(() => {
        if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
            return;
        }

        const registerAndWatch = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registration successful:', registration);

                registration.addEventListener('updatefound', () => {
                    console.log('Service Worker: New version found. Installing...');
                    const newSW = registration.installing;
                    if (!newSW) return;

                    newSW.addEventListener('statechange', () => {
                        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Service Worker: New version installed. Notifying user.');
                            addToast(
                                'info',
                                'Update Available',
                                'A new version of the app is ready.',
                                {
                                    action: {
                                        label: 'Refresh to Update',
                                        onClick: () => window.location.reload(),
                                    },
                                }
                            );
                        }
                    });
                });
            } catch (err) {
                console.error('Service Worker registration failed:', err);
                addToast('error', 'Offline Mode Failed', 'Could not enable offline functionality.');
            }
        };

        registerAndWatch();
    }, [addToast]);

    // This component does not render anything to the DOM.
    return null;
};