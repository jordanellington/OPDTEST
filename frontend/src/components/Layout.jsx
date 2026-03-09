import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Sun, Moon } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 bg-bg-sidebar border-b border-border shrink-0" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="px-2">
          <p className="text-[8px] font-bold tracking-[0.32em] uppercase text-text-muted mb-0.5">
            Covington
          </p>
          <h1 className="font-display text-[20px] font-light text-text-primary leading-none tracking-[-0.01em]">Opinion Letters</h1>
        </div>
        <div className="flex items-center gap-3 pr-4">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
          </button>
          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[10px] font-semibold">
            {(user?.firstName?.[0] || 'U')}{(user?.lastName?.[0] || '')}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-text-muted hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Sign out"
          >
            <LogOut size={13} strokeWidth={1.6} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
