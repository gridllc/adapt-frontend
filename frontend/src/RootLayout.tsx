import React from 'react';
import { Outlet } from 'react-router-dom';

const RootLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
            <Outlet />
        </div>
    );
};

export default RootLayout;
