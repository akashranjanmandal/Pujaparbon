import { Router } from "express";
import { productRoutes } from "./catalog/routes";
import { tripRoutes } from "./trips/routes";
import { stockRoutes } from "./stock/routes";
import { platformRoutes } from "./platforms/routes";
import { investmentRoutes } from "./investments/routes";
import { attendanceRoutes, employeeRoutes } from "./hr/routes";
import { reportRoutes } from "./reports/routes";
import { insightRoutes, settingsRoutes, userRoutes } from "./admin/routes";

/** Every route here sits behind authenticate(); each one also checks its own permission. */
export const apiRoutes = Router();
apiRoutes.use("/insights", insightRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/trips", tripRoutes);
apiRoutes.use("/stock", stockRoutes);
apiRoutes.use("/platforms", platformRoutes);
apiRoutes.use("/investments", investmentRoutes);
apiRoutes.use("/employees", employeeRoutes);
apiRoutes.use("/attendance", attendanceRoutes);
apiRoutes.use("/reports", reportRoutes);
apiRoutes.use("/settings", settingsRoutes);
apiRoutes.use("/users", userRoutes);
