import { Router } from "express";
import { productRoutes } from "./products/routes";
import { stockRoutes } from "./stock/routes";
import { purchaseRoutes, supplierRoutes } from "./purchasing/routes";
import { orderRoutes, returnRoutes } from "./orders/routes";
import { attendanceRoutes, employeeRoutes, leaveRoutes, payrollRoutes, taskRoutes } from "./hr/routes";
import { expenseRoutes, invoiceRoutes } from "./billing/routes";
import { reportRoutes } from "./reports/routes";
import { insightRoutes, settingsRoutes, userRoutes } from "./admin/routes";

/** Every route here sits behind authenticate(); each one also checks its own permission. */
export const apiRoutes = Router();
apiRoutes.use("/insights", insightRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/stock", stockRoutes);
apiRoutes.use("/suppliers", supplierRoutes);
apiRoutes.use("/purchases", purchaseRoutes);
apiRoutes.use("/orders", orderRoutes);
apiRoutes.use("/returns", returnRoutes);
apiRoutes.use("/employees", employeeRoutes);
apiRoutes.use("/tasks", taskRoutes);
apiRoutes.use("/attendance", attendanceRoutes);
apiRoutes.use("/leaves", leaveRoutes);
apiRoutes.use("/payroll", payrollRoutes);
apiRoutes.use("/invoices", invoiceRoutes);
apiRoutes.use("/expenses", expenseRoutes);
apiRoutes.use("/reports", reportRoutes);
apiRoutes.use("/settings", settingsRoutes);
apiRoutes.use("/users", userRoutes);
