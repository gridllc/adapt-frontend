
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './RootLayout';
import HomePage from './pages/HomePage';
import TrainingPage from './pages/TrainingPage';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

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
                path: 'process/:moduleId',
                element: <TrainingPage />,
            },
        ],
    },
]);


const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);