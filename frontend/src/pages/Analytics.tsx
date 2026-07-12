import { useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Download } from "lucide-react";

export function Analytics() {
  const [loading, setLoading] = useState(false);

  const downloadReport = async (type: string) => {
    setLoading(true);
    try {
      // The backend returns text/csv for ?format=csv
      const res = await api.get(`/reports/${type}?format=csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transitops-${type}-report.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error("Failed to download report", err);
      alert("Failed to download report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fuel Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Breakdown of fuel efficiency (km per liter) per vehicle based on completed trips.
            </p>
            <Button onClick={() => downloadReport("fuel-efficiency")} disabled={loading} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Overview of active vs available vehicles across the fleet.
            </p>
            <Button onClick={() => downloadReport("fleet-utilization")} disabled={loading} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Comprehensive financial breakdown of maintenance, fuel, and other expenses per vehicle.
            </p>
            <Button onClick={() => downloadReport("operational-cost")} disabled={loading} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Return on investment analysis (Revenue vs Costs) per vehicle.
            </p>
            <Button onClick={() => downloadReport("vehicle-roi")} disabled={loading} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
