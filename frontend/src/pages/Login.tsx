import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Truck } from "lucide-react";
import axios from "axios";

export function Login() {
  const [email, setEmail] = useState("admin@transitops.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Invalid credentials");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 bg-muted/30 p-12 flex-col justify-between border-r border-border">
        <div>
          <div className="flex items-center gap-3 text-primary mb-2">
            <Truck className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">TransitOps</h1>
          </div>
          <p className="text-muted-foreground">Smart Transport Operations Platform</p>
        </div>

        <div className="space-y-4 max-w-md">
          <h2 className="text-xl font-semibold mb-6">One login, four roles:</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-primary"></span>
              Fleet Manager
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              Dispatcher
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-orange-500"></span>
              Safety Officer
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Financial Analyst
            </li>
          </ul>
        </div>
        
        <p className="text-xs text-muted-foreground/60">TRANSITOPS © 2026 · RBAC ENABLED</p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@transitops.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-sm text-primary hover:underline">Forgot password?</a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Quick Fill Demo Roles:</p>
            <div className="flex flex-wrap gap-2 text-sm font-medium">
              <button 
                type="button"
                onClick={() => setEmail('superadmin@transitops.com')} 
                className="px-3 py-1.5 rounded-md border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
              >
                Admin
              </button>
              <button 
                type="button"
                onClick={() => setEmail('fleet@transitops.com')} 
                className="px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Fleet Manager
              </button>
              <button 
                type="button"
                onClick={() => setEmail('dispatcher@transitops.com')} 
                className="px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Dispatcher
              </button>
              <button 
                type="button"
                onClick={() => setEmail('safety@transitops.com')} 
                className="px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
              >
                Safety Officer
              </button>
              <button 
                type="button"
                onClick={() => setEmail('finance@transitops.com')} 
                className="px-3 py-1.5 rounded-md border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
              >
                Finance Analyst
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
