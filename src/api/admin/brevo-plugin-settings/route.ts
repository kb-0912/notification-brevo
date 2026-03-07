import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import BrevoSettingsModuleService from "../../../modules/brevo-settings/service"
import { BREVO_SETTINGS_MODULE } from "../../../modules/brevo-settings"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const brevoSettingsService: BrevoSettingsModuleService = req.scope.resolve(
    BREVO_SETTINGS_MODULE
  )

  try {
    const settings = await brevoSettingsService.getSettings()
    res.json({ settings })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Brevo settings" })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const brevoSettingsService: BrevoSettingsModuleService = req.scope.resolve(
    BREVO_SETTINGS_MODULE
  )

  try {
    const settings = await brevoSettingsService.upsertSettings(req.body as Record<string, any>)
    res.json({ settings })
  } catch (error: any) {
    console.error("[Brevo] Settings save error:", error?.message || error)
    res.status(500).json({ error: error?.message || "Failed to update Brevo settings" })
  }
}
