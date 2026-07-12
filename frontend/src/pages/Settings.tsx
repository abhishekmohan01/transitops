import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";

export function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and platform preferences.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your current login details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Email Address</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Role Access</p>
                <p className="text-sm text-muted-foreground">{user?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Preferences</CardTitle>
            <CardDescription>Customize how TransitOps looks and behaves.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground">
               Theme preferences are managed using the toggle in the top navigation bar.
             </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={logout}>Sign Out</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
