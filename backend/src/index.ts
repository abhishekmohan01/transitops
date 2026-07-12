import express from "express"
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();


const app = express();


const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(morgan("dev"))
app.use(express.json())


// app.use("/api/auth", authRoutes);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/vehicles", vehicleRoutes);
// app.use("/api/drivers", driverRoutes);
// app.use("/api/trips", tripRoutes);
// app.use("/api/maintenance", maintenanceRoutes);
// app.use("/api/fuel", fuelRoutes);
// app.use("/api/expenses", expenseRoutes);
// app.use("/api/reports", reportRoutes);


app.get("/health",(req,res)=>{
    res.json({
        status:"ok"
    })
})


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});