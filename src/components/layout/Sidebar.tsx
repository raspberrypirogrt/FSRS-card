'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { syncManager, type SyncStatus } from '@/lib/sync/syncManager';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: '/', icon: '🏠', label: '首頁' },
  { href: '/decks', icon: '📚', label: '牌組' },
  { href: '/cards', icon: '🃏', label: '卡片' },
  { href: '/review', icon: '📝', label: '複習' },
  { href: '/ai-generate', icon: '🤖', label: 'AI 生成' },
  { href: '/stats', icon: '📊', label: '統計' },
  { href: '/settings', icon: '⚙️', label: '設定' },
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState('資料已同步');

  useEffect(() => {
    setMounted(true);
    
    // 訂閱同步狀態
    const unsubscribe = syncManager.subscribe((status, message) => {
      setSyncStatus(status);
      if (message) setSyncMessage(message);
      else if (status === 'idle' || status === 'success') setSyncMessage('資料已同步');
    });

    // 初次載入時自動同步
    syncManager.fullSync();

    // 離開頁面或關閉前嘗試同步
    const handleBeforeUnload = () => {
      syncManager.fullSync();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleManualSync = () => {
    syncManager.fullSync();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <span className="app-logo">🧠 FSRS Cards</span>
        <span className="app-version">v1.0</span>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = mounted && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)));
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                // 如果在手機版，點擊導航後自動收合
                if (window.innerWidth <= 768) {
                  onToggle();
                }
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-xs)', cursor: 'pointer', borderRadius: 'var(--radius-md)' }}
          className="nav-item"
          onClick={handleManualSync}
          title="點擊手動同步"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <span style={{ 
              width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
              background: syncStatus === 'syncing' ? 'var(--warning)' : syncStatus === 'error' ? 'var(--danger)' : 'var(--success)',
              boxShadow: syncStatus === 'syncing' ? '0 0 8px var(--warning)' : 'none',
              animation: syncStatus === 'syncing' ? 'pulse 1s infinite' : 'none'
            }}></span>
            <span>{syncStatus === 'syncing' ? '同步中...' : syncMessage}</span>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.5 }}>🔄</span>
        </div>
      </div>
    </aside>
  );
}
