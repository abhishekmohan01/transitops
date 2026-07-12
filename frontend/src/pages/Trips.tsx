import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { MapPin, Navigation, AlertCircle, Lock } from "lucide-react";
import { hasPermission, getRequiredRolesText, ROLES } from "../lib/rbac";
import { useAuth } from "../contexts/AuthContext";

interface Trip {
  id: number;
  vehicleId: number;
  driverId: number;
  source: string;
  destination: string;
  status: "DRAFT" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
  plannedDistance: number;
}

interface Vehicle {
  id: number;
  registrationNumber: string;
  name: string;
}

interface Driver {
  id: number;
  name: string;
}

export function Trips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const canManageTrips = hasPermission(user?.role, [ROLES.FLEET_MANAGER, ROLES.DRIVER]);

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: "",
    driverId: "",
    origin: "",
    destination: "",
    distanceKm: 10,
    cargoDetails: ""
  });
  
  const [formError, setFormError] = useState("");
  const [completeTripId, setCompleteTripId] = useState<number | null>(null);
  const [completeData, setCompleteData] = useState({
    finalOdometer: "",
    fuelConsumed: "",
    revenue: ""
  });

  const fetchData = async () => {
    try {
      const [tripsRes, vehiclesRes, driversRes] = await Promise.all([
        api.get("/trips"),
        api.get("/vehicles?status=AVAILABLE"),
        api.get("/drivers?status=AVAILABLE")
      ]);
      setTrips(tripsRes.data.data);
      setVehicles(vehiclesRes.data.data);
      setDrivers(driversRes.data.data);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      await api.post("/trips", {
        vehicleId: Number(formData.vehicleId),
        driverId: Number(formData.driverId),
        source: formData.origin,
        destination: formData.destination,
        plannedDistance: Number(formData.distanceKm),
        cargoWeight: 100
      });
      setFormData({ vehicleId: "", driverId: "", origin: "", destination: "", distanceKm: 10, cargoDetails: "" });
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Error creating trip");
    }
  };

  const handleStartTrip = async (id: number) => {
    setFormError("");
    try {
      await api.patch(`/trips/${id}/dispatch`);
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Error starting trip");
    }
  };

  const submitCompleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!completeTripId) return;
    try {
      await api.patch(`/trips/${completeTripId}/complete`, {
        finalOdometer: Number(completeData.finalOdometer),
        fuelConsumed: Number(completeData.fuelConsumed),
        revenue: Number(completeData.revenue)
      });
      setCompleteTripId(null);
      setCompleteData({ finalOdometer: "", fuelConsumed: "", revenue: "" });
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Error completing trip");
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Trip Dispatcher</h1>
      </div>

      <div className="flex flex-1 gap-6 min-h-[500px]">
        {/* Left: Dispatch Form */}
        <Card className="w-1/3 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              New Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {formError && (
              <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {formError}
              </div>
            )}
            <form onSubmit={handleDispatch} className="space-y-4">
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <select 
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                  required
                >
                  <option value="" disabled>Select Available Vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} - {v.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Driver</Label>
                <select 
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.driverId}
                  onChange={(e) => setFormData({...formData, driverId: e.target.value})}
                  required
                >
                  <option value="" disabled>Select Available Driver</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Origin</Label>
                <Input required value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Destination</Label>
                <Input required value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Est. Distance (km)</Label>
                <Input type="number" required value={formData.distanceKm} onChange={e => setFormData({...formData, distanceKm: e.target.value as any})} />
              </div>
              
              <div className="space-y-2">
                <Label>Cargo Details (Optional)</Label>
                <Input value={formData.cargoDetails} onChange={e => setFormData({...formData, cargoDetails: e.target.value})} />
              </div>

              <Button type="submit" className="w-full mt-4" disabled={!canManageTrips} title={!canManageTrips ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER, ROLES.DRIVER])}` : undefined}>
                {!canManageTrips && <Lock className="mr-2 h-4 w-4" />}
                Dispatch Trip
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Live Trips Board */}
        <Card className="flex-1 flex flex-col bg-muted/30">
          <CardHeader>
            <CardTitle>Live Trips Board</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="text-center p-4">Loading...</div>
            ) : trips.filter(t => t.status === "DRAFT" || t.status === "DISPATCHED").length === 0 ? (
              <div className="text-center p-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                No active trips
              </div>
            ) : (
              trips.filter(t => t.status === "DRAFT" || t.status === "DISPATCHED").map(trip => (
                <div key={trip.id} className="bg-background p-4 rounded-lg border border-border shadow-sm flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-lg">TRP-{trip.id}</span>
                      <Badge variant={trip.status === "DISPATCHED" ? "default" : "secondary"}>
                        {trip.status.replace("_", " ")}
                      </Badge>
                      {trip.status === "DISPATCHED" && (
                        <span className="relative flex h-3 w-3 ml-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {trip.source} <span className="mx-1">→</span> {trip.destination}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {trip.status === "DRAFT" && (
                      <Button size="sm" disabled={!canManageTrips} title={!canManageTrips ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER, ROLES.DRIVER])}` : undefined} onClick={() => handleStartTrip(trip.id)}>
                        {!canManageTrips && <Lock className="mr-1 h-3 w-3" />}
                        Start
                      </Button>
                    )}
                    {trip.status === "DISPATCHED" && (
                      <Button size="sm" variant="outline" className="text-emerald-500 border-emerald-500 hover:bg-emerald-500/10" disabled={!canManageTrips} title={!canManageTrips ? `Locked. Allowed roles: ${getRequiredRolesText([ROLES.FLEET_MANAGER, ROLES.DRIVER])}` : undefined} onClick={() => setCompleteTripId(trip.id)}>
                        {!canManageTrips && <Lock className="mr-1 h-3 w-3" />}
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={!!completeTripId} onOpenChange={(open) => !open && setCompleteTripId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Trip TRP-{completeTripId}</DialogTitle>
          </DialogHeader>
          {formError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {formError}
            </div>
          )}
          <form onSubmit={submitCompleteTrip} className="space-y-4">
            <div className="space-y-2">
              <Label>Final Odometer Reading</Label>
              <Input type="number" required value={completeData.finalOdometer} onChange={e => setCompleteData({...completeData, finalOdometer: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Fuel Consumed (Liters)</Label>
              <Input type="number" required value={completeData.fuelConsumed} onChange={e => setCompleteData({...completeData, fuelConsumed: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Total Revenue ($)</Label>
              <Input type="number" required value={completeData.revenue} onChange={e => setCompleteData({...completeData, revenue: e.target.value})} />
            </div>
            <Button type="submit" className="w-full">Submit & Complete</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
