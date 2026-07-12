import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AlertTriangle, Car, ShieldAlert, Truck, Wrench } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DashboardData {
  vehicles: { total: number; active: number; available: number; inMaintenance: number; retired: number; };
  trips: { active: number; pending: number; };
  drivers: { onDuty: number; available: number; expiringLicenses: number; };
  fleetUtilization: number;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<DashboardData>("/dashboard");
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading dashboard metrics...</div>;
  if (!data) return <div className="p-8">Error loading dashboard</div>;

  const chartData = [
    { name: "Available", value: data.vehicles.available, color: "#10b981" },
    { name: "On Trip", value: data.vehicles.active, color: "#3b82f6" },
    { name: "In Shop", value: data.vehicles.inMaintenance, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {data.drivers.expiringLicenses > 0 && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-md flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-destructive">Driver License Warning</h3>
            <p className="text-sm text-destructive/80 mt-1">
              You have {data.drivers.expiringLicenses} driver(s) whose license expires within 30 days. Please review the drivers tab.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{data.vehicles.active}</div>
            <p className="text-xs text-muted-foreground mt-1">out of {data.vehicles.total} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Available Vehicles</CardTitle>
            <Car className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-500">{data.vehicles.available}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">In Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-500">{data.vehicles.inMaintenance}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Trips</CardTitle>
            <ShieldAlert className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-500">{data.trips.active}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.trips.pending} pending dispatch</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fleet Utilization</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground">No fleet data</div>
            )}
            
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold">{data.fleetUtilization}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder for Recent Trips or other wider content */}
        <Card className="col-span-1 lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle>Recent Trips Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg text-muted-foreground">
              Recent trips table will appear here
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
