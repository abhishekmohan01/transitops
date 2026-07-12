import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Wrench } from "lucide-react";
import axios from "axios";

interface Vehicle {
  id: number;
  registrationNumber: string;
  name: string;
}

interface MaintenanceLog {
  id: number;
  vehicle: Vehicle;
  description: string;
  cost: number;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
}

export function Maintenance() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: "",
    description: "",
    cost: 0,
  });

  const fetchData = async () => {
    try {
      const [logsRes, vehiclesRes] = await Promise.all([
        api.get("/maintenance"),
        api.get("/vehicles") // Ideally we'd filter for NOT IN_SHOP, but let backend handle BR validation for now
      ]);
      setLogs(logsRes.data.data);
      setVehicles(vehiclesRes.data.data);
    } catch (err) {
      console.error("Failed to fetch maintenance data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/maintenance", {
        vehicleId: Number(formData.vehicleId),
        description: formData.description,
        cost: Number(formData.cost)
      });
      setIsDialogOpen(false);
      setFormData({ vehicleId: "", description: "", cost: 0 });
      fetchData();
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Error opening maintenance");
      }
    }
  };

  const handleCloseMaintenance = async (id: number) => {
    try {
      await api.patch(`/maintenance/${id}/close`);
      fetchData();
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Error closing maintenance");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Wrench className="mr-2 h-4 w-4" />
              Log Maintenance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Maintenance Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleOpenMaintenance} className="space-y-4">
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
              <div className="space-y-2">
                <Label>Description</Label>
                <Input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="E.g. Oil change and brake inspection" />
              </div>
              <div className="space-y-2">
                <Label>Estimated Cost ($)</Label>
                <Input type="number" required value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value as any})} />
              </div>
              <Button type="submit" className="w-full">Submit</Button>
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
              <TableHead>Description</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No maintenance logs found</TableCell></TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{log.vehicle.registrationNumber}</TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>${log.cost.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "ACTIVE" ? "destructive" : "secondary"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => handleCloseMaintenance(log.id)}>
                        Mark Closed
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
