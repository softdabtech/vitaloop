import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Activity, Target, TrendingUp, 
  Clock, Settings, LogOut, ChevronRight, Home,
  FileText, BarChart3, AlertCircle 
} from 'lucide-react';

export default function UserDashboardSidebar({ isOpen, toggleSidebar, user, onLogout }) {
  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard', badge: null },
    { icon: FileText, label: 'Upload Labs', path: '/upload', badge: null },
    { icon: FileText, label: 'Lab Results', path: '/lab-results', badge: null },
    { icon: Target, label: 'Assignments', path: '/assignments', badge: user?.pending_assignments || 0 },
    { icon: TrendingUp, label: 'Progress', path: '/progress', badge: null },
    { icon: BarChart3, label: 'Insights', path: '/timeline', badge: null },
    { icon: Clock, label: 'Check-ins', path: '/checkin', badge: null },
    { icon: Activity, label: 'Onboarding', path: '/onboarding', badge: null },
    { icon: AlertCircle, label: 'Legacy Dashboard', path: '/dashboard-legacy', badge: null },
  ];

  return (
    <div
      className={`${
        isOpen ? 'w-64' : 'w-20'
      } bg-slate-900 border-r border-slate-700 transition-all duration-300 flex flex-col h-screen`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-700">
        <div className={`flex items-center gap-3 ${!isOpen && 'hidden'}`}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm">VITALOOP</span>
            <span className="text-slate-400 text-xs">Health+</span>
          </div>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-slate-800 rounded transition"
        >
          <ChevronRight
            className={`w-5 h-5 text-slate-400 transition-transform ${
              !isOpen && 'rotate-180'
            }`}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-2 px-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `group flex items-center gap-3 px-3 py-2 rounded-lg transition relative ${
              isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0 group-hover:text-emerald-400 transition" />
            {isOpen && (
              <>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-semibold">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="border-t border-slate-700 mx-2"></div>

      {/* Footer */}
      <div className="p-4 space-y-2 border-t border-slate-700">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {isOpen && <span className="text-sm">Settings</span>}
        </NavLink>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-slate-800 transition"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isOpen && <span className="text-sm">Logout</span>}
        </button>
      </div>

      {/* User Profile */}
      {isOpen && (
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
