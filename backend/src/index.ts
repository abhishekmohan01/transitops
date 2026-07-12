import express from "express"
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { AppError } from "./utils/errors.js";
import authRoutes from "./routes/auth.js";
import driverRoutes from "./routes/drivers.js";
import tripRoutes from "./routes/trips.js";

dotenv.config();

const app = express();


const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(morgan("dev"))
app.use(express.json())


app.use("/api/auth", authRoutes);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/vehicles", vehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
// app.use("/api/maintenance", maintenanceRoutes);
// app.use("/api/fuel", fuelRoutes);
// app.use("/api/expenses", expenseRoutes);
// app.use("/api/reports", reportRoutes);


app.get("/health",(req,res)=>{
    res.json({
        status:"ok"
    })
})

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});