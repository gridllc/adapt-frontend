

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Corrected import paths based on the project file structure
import RootLayout from '@/RootLayout';
import HomePage from '@/pages/HomePage';
import TrainingPage from '@/pages/TrainingPage';
import CreatePage from '@/pages/CreatePage';
import EditPage from '@/pages/EditPage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import FaqPage from '@/pages/FaqPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ToastProvider } from '@/hooks/useToast';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/hooks/useAuth';
import './index.css';
import LiveCoachPage from '@/pages/LiveCoachPage';
import SessionReviewPage from '@/pages/SessionReviewPage';
import { PwaUpdater } from '@/components/PwaUpdater';
import QuestionLogDetailPage from './pages/QuestionLogDetailPage';
import { supabase } from '@/services/apiClient';
import AdminLayout from '@/components/AdminLayout';

// Expose Supabase client for debugging in development mode
if (import.meta.env.DEV) {
    (window as any).supabase = supabase;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const queryClient = new QueryClient();

const router = createBrowserRouter([
    {
        path: '/',
        element: <RootLayout />,
        children: [
            {
                index: true,
                element: <HomePage />,
            },
            {
                path: 'login',
                element: <LoginPage />,
            },
            {
                element: (
                    <ProtectedRoute>
                        <AdminLayout />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: 'dashboard',
                        element: <DashboardPage />,
                    },
                    {
                        path: 'dashboard/questions',
                        element: <FaqPage />,
                    },
                    {
                        path: 'dashboard/questions/:moduleId/:stepIndex/:encodedQuestion',
                        element: <QuestionLogDetailPage />,
                    },
                    {
                        path: 'modules/:moduleId/edit',
                        element: <EditPage />,
                    },
                    {
                        path: 'modules/:moduleId/live',
                        element: <LiveCoachPage />,
                    },
                    {
                        path: 'sessions/:moduleId/:session_key/review',
                        element: <SessionReviewPage />,
                    },
                    {
                        path: 'create',
                        element: <CreatePage />,
                    },
                ]
            },
            {
                path: 'modules/:moduleId',
                element: <TrainingPage />,
            },
            {
                path: '*', // Catch-all for 404
                element: <NotFoundPage />,
            }
        ],
    },
]);


const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AuthProvider debug={import.meta.env.DEV}>
                    <ToastProvider>
                        <RouterProvider router={router} />
                        <PwaUpdater />
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
);