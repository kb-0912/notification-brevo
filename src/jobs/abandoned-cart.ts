import { MedusaContainer } from "@medusajs/framework/types";
import { checkAbandonedCartsWorkflow } from "../workflows/steps/check-abandoned-carts";

export default async function checkAbandonedCartsJob(container: MedusaContainer) {
  const logger = container.resolve("logger");
  
  try {
   
    await checkAbandonedCartsWorkflow(container).run({
      input: {
        container,
      },
    });
  } catch (error) {
    logger.error("Error in check-abandoned-carts scheduled job:", error);
  }
}

export const config = {
  name: "check-abandoned-carts",
  schedule: "1 * * * *", // Chạy mỗi giờ
};