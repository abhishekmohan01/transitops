import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { hasPermission, getRequiredRolesText, ROLES } from "../lib/rbac";
import { useAuth } from "../contexts/AuthContext";
import { Lock } from "lucide-react";

interface Vehicle {
  id: number;
  registrationNumber: string;
  name: string;
  type: string;
  maxLoadCapacity: number;
  odometer: number;
  acquisitionCost: number;
  imageUrl?: string;
  status: "AVAILABLE" | "ON_TRIP" | "IN_SHOP" | "RETIRED";
}

export function Vehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const canManageFleet = hasPermission(user?.role, [ROLES.FLEET_MANAGER]);

  // Form state
  const [formData, setFormData] = useState({
    registrationNumber: "",
    name: "",
    type: "Van",
    maxLoadCapacity: 500,
    acquisitionCost: 10000,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchVehicles = async () => {
    try {
      const res = await api.get("/vehicles");
      setVehicles(res.data.data);
    } catch (err) {
      console.error("Failed to fetch vehicles", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let imageUrl = undefined;
      
      if (selectedFile) {
        setUploadingImage(true);
        const uploadData = new FormData();
        uploadData.append("file", selectedFile);
        
        const uploadRes = await api.post("/upload", uploadData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        imageUrl = uploadRes.data.url;
      }

      await api.post("/vehicles", {
        ...formData,
        maxLoadCapacity: Number(formData.maxLoadCapacity),
        acquisitionCost: Number(formData.acquisitionCost),
        ...(imageUrl ? { imageUrl } : {})
      });
      
      setIsDialogOpen(false);
      setFormData({ registrationNumber: "", name: "", type: "Van", maxLoadCapacity: 500, acquisitionCost: 10000 });
      setSelectedFile(null);
      setUploadingImage(false);
      fetchVehicles();
    } catch (err) {
      console.error("Failed to create vehicle", err);
      alert("Error creating vehicle");
      setUploadingImage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "AVAILABLE": return "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20";
      case "ON_TRIP": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20";
      case "IN_SHOP": return "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20";
      case "RETIRED": return "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Vehicle Registry</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canManageFleet} title={!canManageFleet ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER])}` : undefined}>
              {!canManageFleet && <Lock className="w-4 h-4 mr-2" />}
              + Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Vehicle</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input required value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Name / Model</Label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Capacity (kg)</Label>
                  <Input type="number" required value={formData.maxLoadCapacity} onChange={e => setFormData({...formData, maxLoadCapacity: e.target.value as any})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Acquisition Cost</Label>
                <Input type="number" required value={formData.acquisitionCost} onChange={e => setFormData({...formData, acquisitionCost: e.target.value as any})} />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Image (Optional)</Label>
                <Input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
              </div>
              <Button type="submit" className="w-full" disabled={uploadingImage}>
                {uploadingImage ? "Uploading..." : "Save Vehicle"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg. No.</TableHead>
              <TableHead>Name/Model</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Odometer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : vehicles.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No vehicles found</TableCell></TableRow>
            ) : (
              vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.registrationNumber}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {v.imageUrl ? (
                        <img src={v.imageUrl} alt={v.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">🚗</div>
                      )}
                      {v.name}
                    </div>
                  </TableCell>
                  <TableCell>{v.type}</TableCell>
                  <TableCell>{v.maxLoadCapacity} kg</TableCell>
                  <TableCell>{v.odometer.toLocaleString()} km</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(v.status)}>
                      {v.status.replace("_", " ")}
                    </Badge>
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
