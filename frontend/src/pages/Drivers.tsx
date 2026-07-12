import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { MoreHorizontal, UserPlus, Lock } from "lucide-react";
import { hasPermission, getRequiredRolesText, ROLES } from "../lib/rbac";
import { useAuth } from "../contexts/AuthContext";

interface Driver {
  id: number;
  name: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  status: "AVAILABLE" | "ON_TRIP" | "OFF_DUTY" | "SUSPENDED";
}

export function Drivers() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const canManageDrivers = hasPermission(user?.role, [ROLES.FLEET_MANAGER]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    licenseNumber: "",
    licenseCategory: "Class C",
    licenseExpiryDate: "",
    contactNumber: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchDrivers = async () => {
    try {
      const res = await api.get("/drivers");
      setDrivers(res.data.data);
    } catch (err) {
      console.error("Failed to fetch drivers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/drivers/${id}/status`, { status: newStatus });
      fetchDrivers();
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Error updating driver status");
    }
  };

  const isExpiringSoon = (dateString: string) => {
    const expiry = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(expiry.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 30;
  };

  const handleAddDriver = async (e: React.FormEvent) => {
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

      await api.post("/drivers", {
        ...formData,
        licenseExpiryDate: new Date(formData.licenseExpiryDate).toISOString(),
        imageUrl
      });
      
      setIsDialogOpen(false);
      setFormData({ name: "", licenseNumber: "", licenseCategory: "Class C", licenseExpiryDate: "", contactNumber: "" });
      setSelectedFile(null);
      fetchDrivers();
    } catch (err) {
      console.error("Failed to add driver", err);
      alert("Error adding driver");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Drivers Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canManageDrivers} title={!canManageDrivers ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER])}` : undefined}>
              {!canManageDrivers ? <Lock className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Driver</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>License Number</Label>
                  <Input required value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>License Category</Label>
                  <Input required value={formData.licenseCategory} onChange={e => setFormData({...formData, licenseCategory: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input type="date" required value={formData.licenseExpiryDate} onChange={e => setFormData({...formData, licenseExpiryDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input required value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Driver Photo (Optional)</Label>
                <Input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
              </div>
              <Button type="submit" className="w-full" disabled={uploadingImage}>
                {uploadingImage ? "Uploading..." : "Save Driver"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>License #</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
            ) : drivers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No drivers found</TableCell></TableRow>
            ) : (
              drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="font-mono">{d.licenseNumber}</TableCell>
                  <TableCell>
                    <span className={isExpiringSoon(d.licenseExpiryDate) ? "text-destructive font-semibold flex items-center gap-2" : ""}>
                      {new Date(d.licenseExpiryDate).toLocaleDateString()}
                      {isExpiringSoon(d.licenseExpiryDate) && <Badge variant="destructive" className="text-[10px] uppercase">Expiring</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.status === "AVAILABLE" ? "default" : "secondary"}>
                      {d.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={!canManageDrivers} title={!canManageDrivers ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER])}` : undefined}>
                          {!canManageDrivers ? <Lock className="h-4 w-4 text-muted-foreground/50" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStatusChange(d.id, "AVAILABLE")}>Set Available</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(d.id, "OFF_DUTY")}>Set Off Duty</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(d.id, "SUSPENDED")}>Suspend</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
