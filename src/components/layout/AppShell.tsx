'use client';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // 初始化
    checkMobile();
    
    // 監聽視窗大小改變
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar 
        isOpen={!isMobile || sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
      />
      
      {/* 行動版側邊欄遮罩 */}
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay visible" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      <div className="main-content">
        {isMobile && <MobileHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />}
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  );
}
