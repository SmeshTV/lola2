import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Gamepad2, Home, Trophy, ShoppingBag, LayoutDashboard,
  LogIn, LogOut, Shield, Menu, X, Sun, Moon,
  ChevronDown, Radio, Dice1, Ticket, AlertTriangle,
  HelpCircle, Users, Mail, Info, Star, Calendar, ScrollText, FileText
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

interface NavCategory {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const Navbar = () => {
  const location = useLocation();
  const { user, permissions, signInWithDiscord, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закрытие dropdown при клике снаружи
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Закрытие dropdown при смене маршрута
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [location.pathname]);

  const showAdmin = permissions?.isAdmin || permissions?.isEventMaker || permissions?.isSpecial;

  // Категории навигации
  const mainItems: NavItem[] = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
  ];

  const categories: NavCategory[] = [
    {
      label: 'Игры',
      icon: Gamepad2,
      items: [
        { path: '/games', icon: Gamepad2, label: 'Все игры' },
        { path: '/play', icon: Gamepad2, label: 'Мини-игры' },
        { path: '/casino', icon: Dice1, label: 'Казино' },
      ],
    },
    {
      label: 'Сообщество',
      icon: Trophy,
      items: [
        { path: '/events', icon: Calendar, label: 'Мероприятия' },
        { path: '/leaderboard', icon: Trophy, label: 'Лидеры' },
        { path: '/shop', icon: ShoppingBag, label: 'Магазин' },
        { path: '/reviews', icon: Star, label: 'Отзывы' },
        { path: '/apply', icon: FileText, label: 'Подать на роль' },
        { path: '/monitoring', icon: Radio, label: 'Мониторинг' },
      ],
    },
    {
      label: 'Информация',
      icon: HelpCircle,
      items: [
        { path: '/rules', icon: ScrollText, label: 'Правила' },
        { path: '/faq', icon: HelpCircle, label: 'FAQ' },
        { path: '/team', icon: Users, label: 'Команда' },
        { path: '/contact', icon: Mail, label: 'Контакты' },
      ],
    },
  ];

  const supportItems: NavItem[] = [
    { path: '/tickets', icon: Ticket, label: 'Тикеты' },
    { path: '/warnings', icon: AlertTriangle, label: 'Варны' },
  ];

  // Проверка активного пункта
  const isActive = (path: string) => location.pathname === path;

  // Проверка активной категории
  const isCategoryActive = (cat: NavCategory) => cat.items.some(item => isActive(item.path));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl font-bold gradient-text">🍄 LOLA</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1" ref={dropdownRef}>
            {/* Основные */}
            {mainItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
                    active
                      ? 'bg-mushroom-neon/20 text-mushroom-neon'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}

            {/* Категории с dropdown */}
            {categories.map((cat) => {
              const Icon = cat.icon;
              const open = openDropdown === cat.label;
              const active = isCategoryActive(cat);

              return (
                <div key={cat.label} className="relative">
                  <button
                    onClick={() => setOpenDropdown(open ? null : cat.label)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
                      active || open
                        ? 'bg-mushroom-neon/20 text-mushroom-neon'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} />
                    {cat.label}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown меню */}
                  {open && (
                    <div className="absolute top-full left-0 mt-2 w-48 py-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50">
                      {cat.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = isActive(item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                              itemActive
                                ? 'bg-mushroom-neon/10 text-mushroom-neon'
                                : 'text-gray-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <ItemIcon size={16} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Разделитель */}
            <div className="w-px h-6 bg-white/10 mx-2" />

            {/* Поддержка */}
            {supportItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
                    active
                      ? 'bg-mushroom-neon/20 text-mushroom-neon'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Правая часть */}
          <div className="flex items-center gap-2">
            {/* Тема */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all hover:scale-110 active:scale-95 text-gray-300 hover:text-yellow-400 hover:bg-white/10"
              aria-label="Переключить тему"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Админ */}
            {showAdmin && (
              <Link
                to="/admin"
                className={`p-2 rounded-xl transition-all hidden sm:flex items-center gap-1 ${
                  isActive('/admin')
                    ? 'bg-mushroom-neon/20 text-mushroom-neon border border-mushroom-neon/30'
                    : 'text-gray-300 hover:text-mushroom-neon hover:bg-white/5'
                }`}
                title="Админ-панель"
              >
                <Shield size={16} />
              </Link>
            )}

            {/* Пользователь */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mushroom-neon to-mushroom-purple flex items-center justify-center text-xs font-bold text-black">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={signOut}
                  className="text-sm text-gray-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                  title="Выйти"
                >
                  <LogOut size={14} />
                  <span className="hidden lg:inline">Выйти</span>
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithDiscord}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-discord hover:bg-discord-dark text-white text-sm font-medium rounded-xl transition-all"
              >
                <LogIn size={14} />
                <span className="hidden lg:inline">Войти</span>
              </button>
            )}

            {/* Мобильное меню */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl text-gray-300 hover:text-mushroom-neon hover:bg-white/5"
              aria-label="Меню"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden pb-4 space-y-1 overflow-y-auto max-h-[80vh] border-t border-white/10 mt-2 pt-3">
            {/* Основные */}
            {mainItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                    active
                      ? 'bg-mushroom-neon/20 text-mushroom-neon'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}

            {/* Категории */}
            {categories.map((cat) => {
              const Icon = cat.icon;
              const open = openDropdown === cat.label;
              const active = isCategoryActive(cat);

              return (
                <div key={cat.label}>
                  <button
                    onClick={() => setOpenDropdown(open ? null : cat.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium ${
                      active || open
                        ? 'bg-mushroom-neon/20 text-mushroom-neon'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={20} />
                      {cat.label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {open && (
                    <div className="ml-6 mt-1 space-y-1">
                      {cat.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = isActive(item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${
                              itemActive
                                ? 'text-mushroom-neon bg-mushroom-neon/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <ItemIcon size={16} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Поддержка */}
            <div className="border-t border-white/10 my-2 mx-4" />
            {supportItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                    active
                      ? 'bg-mushroom-neon/20 text-mushroom-neon'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}

            {/* Кнопки действий */}
            <div className="flex gap-2 pt-4 px-4">
              {showAdmin && (
                <Link
                  to="/admin"
                  className="flex-1 btn-primary text-center text-sm flex items-center justify-center gap-2"
                >
                  <Shield size={16} />
                  Админ
                </Link>
              )}
              {user ? (
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="flex-1 btn-discord text-sm flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Выйти
                </button>
              ) : (
                <button
                  onClick={() => { signInWithDiscord(); setMobileOpen(false); }}
                  className="flex-1 btn-discord text-sm flex items-center justify-center gap-2"
                >
                  <LogIn size={16} />
                  Войти
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
