import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { MoreHorizontal, UserPlus } from "lucide-react";

interface Driver {
  id: number;
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: "ON_DUTY" | "OFF_DUTY" | "ON_LEAVE" | "TERMINATED";
}

export function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Drivers Management</h1>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Driver
        </Button>
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
                    <span className={isExpiringSoon(d.licenseExpiry) ? "text-destructive font-semibold flex items-center gap-2" : ""}>
                      {new Date(d.licenseExpiry).toLocaleDateString()}
                      {isExpiringSoon(d.licenseExpiry) && <Badge variant="destructive" className="text-[10px] uppercase">Expiring</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.status === "ON_DUTY" ? "default" : "secondary"}>
                      {d.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStatusChange(d.id, "ON_DUTY")}>Set On Duty</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(d.id, "OFF_DUTY")}>Set Off Duty</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(d.id, "ON_LEAVE")}>Set On Leave</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(d.id, "TERMINATED")}>Terminate</DropdownMenuItem>
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
