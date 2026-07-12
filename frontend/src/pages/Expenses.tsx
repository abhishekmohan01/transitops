import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Fuel, Lock } from "lucide-react";
import axios from "axios";
import { hasPermission, getRequiredRolesText, ROLES } from "../lib/rbac";
import { useAuth } from "../contexts/AuthContext";

interface Vehicle {
  id: number;
  registrationNumber: string;
  name: string;
}

interface FuelLog {
  id: number;
  vehicle: Vehicle;
  liters: number;
  cost: number;
  date: string;
  createdAt: string;
}

export function Expenses() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const canLogFuel = hasPermission(user?.role, [ROLES.FLEET_MANAGER, ROLES.DRIVER]);

  const [formData, setFormData] = useState({
    vehicleId: "",
    liters: 0,
    cost: 0,
    date: new Date().toISOString().split('T')[0],
  });

  const fetchData = async () => {
    try {
      const [logsRes, vehiclesRes] = await Promise.all([
        api.get("/fuel"),
        api.get("/vehicles")
      ]);
      setLogs(logsRes.data.data);
      setVehicles(vehiclesRes.data.data);
    } catch (err) {
      console.error("Failed to fetch fuel data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/fuel", {
        vehicleId: Number(formData.vehicleId),
        liters: Number(formData.liters),
        cost: Number(formData.cost),
        date: new Date(formData.date).toISOString()
      });
      setIsDialogOpen(false);
      setFormData({ vehicleId: "", liters: 0, cost: 0, date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Error logging fuel");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Fuel Logs</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canLogFuel} title={!canLogFuel ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER, ROLES.DRIVER])}` : undefined}>
              {!canLogFuel ? <Lock className="mr-2 h-4 w-4" /> : <Fuel className="mr-2 h-4 w-4" />}
              Log Fuel Purchase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Fuel Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLogFuel} className="space-y-4">
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <select 
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                  required
                >
                  <option value="" disabled>Select Vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} - {v.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Liters</Label>
                  <Input type="number" step="0.1" required value={formData.liters} onChange={e => setFormData({...formData, liters: e.target.value as any})} />
                </div>
                <div className="space-y-2">
                  <Label>Total Cost ($)</Label>
                  <Input type="number" step="0.01" required value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value as any})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <Button type="submit" className="w-full">Save Entry</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Liters</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No fuel logs found</TableCell></TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{log.vehicle.registrationNumber}</TableCell>
                  <TableCell>{log.liters.toLocaleString()} L</TableCell>
                  <TableCell>${log.cost.toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
