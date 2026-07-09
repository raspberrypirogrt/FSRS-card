'use client';
import { usePathname } from 'next/navigation';

interface MobileHeaderProps {
  onMenuToggle: () => void;
}

const routeTitles: Record<string, string> = {
  '/': '首頁',
  '/decks': '牌組管理',
  '/cards': '卡片瀏覽',
  '/review': '開始複習',
  '/ai-generate': 'AI 卡片生成',
  '/stats': '統計分析',
  '/settings': '設定',
};

export function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  const pathname = usePathname();
  
  // 找出當前路徑對應的標題，如果是動態路由（如 /decks/123），用 startsWith 判斷
  let title = 'FSRS Cards';
  if (pathname) {
    const matchedRoute = Object.keys(routeTitles).find(route => 
      route === '/' ? pathname === '/' : pathname.startsWith(route)
    );
    if (matchedRoute) {
      title = routeTitles[matchedRoute];
    }
  }

  return (
    <header className="mobile-header">
      <button className="menu-btn" onClick={onMenuToggle} aria-label="選單">
        ☰
      </button>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ width: '40px' }}></div> {/* 平衡用空白區塊 */}
    </header>
  );
}
