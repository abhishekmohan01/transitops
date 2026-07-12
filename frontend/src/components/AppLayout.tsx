import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "./theme-provider";
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  MapPin, 
  Wrench, 
  Fuel, 
  BarChart3, 
  Settings,
  LogOut,
  Sun,
  Moon
} from "lucide-react";
import { Button } from "./ui/button";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Fleet", path: "/vehicles", icon: Truck },
  { label: "Drivers", path: "/drivers", icon: Users },
  { label: "Trips", path: "/trips", icon: MapPin },
  { label: "Maintenance", path: "/maintenance", icon: Wrench },
  { label: "Fuel & Expenses", path: "/expenses", icon: Fuel },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="font-bold text-xl text-primary tracking-tight">TransitOps</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center mb-2">TransitOps © 2026</p>
          <p className="text-[10px] text-muted-foreground/50 text-center">RBAC ENABLED</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-8">
          <div className="flex-1">
            {/* Global Search Placeholder */}
            <div className="max-w-md">
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-muted/50 border border-border rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-right leading-tight">
                <div>{user?.email.split('@')[0]}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role.toLowerCase().replace('_', ' ')}</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                {user?.email.charAt(0).toUpperCase()}
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
