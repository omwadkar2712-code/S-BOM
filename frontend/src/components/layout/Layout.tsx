import React from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { AddProjectModal } from '../common/AddProjectModal';
import { AddDependencyModal } from '../common/AddDependencyModal';
import { VulnerabilityDrawer } from '../common/VulnerabilityDrawer';
import { ToastContainer } from '../common/Toast';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Collapsed icon sidebar expanding smoothly on hover */}
      <Sidebar />

      {/* Main Content Area offset by 72px for the collapsed icon bar */}
      <div className="flex flex-col min-h-screen pl-[72px] transition-all duration-300 ease-in-out">
        {/* Top sticky header */}
        <TopHeader />

        {/* Page body content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <GlobalSearchModal />
      <AddProjectModal />
      <AddDependencyModal />
      <VulnerabilityDrawer />
      <ToastContainer />
    </div>
  );
};
