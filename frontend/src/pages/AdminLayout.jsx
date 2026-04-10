import React from 'react';
import Navbar from './Navbar';
import Footer from '../components/Footer';

const AdminLayout = ({ children, disableScroll = false }) => {
  return (
    <div className="h-screen flex flex-col w-full overflow-hidden lms-page-bg">
      {/* Top navbar */}
      <header className="flex-none z-50">
        <Navbar />
      </header>

      {/* Main content area */}
      <main className={`flex-1 w-full ${disableScroll ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'}`}>
        {disableScroll ? (
          <div className="w-full h-full">{children}</div>
        ) : (
          <div className="w-full min-h-full flex flex-col">
            <div className="flex-1 py-6">
              <div className="lms-container">{children}</div>
            </div>
            <Footer />
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminLayout;
