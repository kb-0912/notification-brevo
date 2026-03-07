import { MedusaContainer } from "@medusajs/framework/types"
import { checkAbandonedCartsWorkflow } from "../workflows/steps/check-abandoned-carts"

export default async function checkAbandonedCartsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")

  try {
    await checkAbandonedCartsWorkflow(container).run({})
  } catch (error: any) {
    logger.error(`[Brevo] Abandoned cart job error: ${error.message}`)
  }
}

export const config = {
  name: "check-abandoned-carts",
  // Cron expression: run every 15 minutes
  schedule: "*/15 * * * *",
}