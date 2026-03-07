import BrevoSettingsModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const BREVO_SETTINGS_MODULE = "brevo_settings"

export default Module(BREVO_SETTINGS_MODULE, {
    service: BrevoSettingsModuleService,
})
