import { Module } from "@medusajs/framework/utils"
import CjFulfillmentModuleService from "./service"

export const CJ_FULFILLMENT_MODULE = "cjFulfillment"

export default Module(CJ_FULFILLMENT_MODULE, {
  service: CjFulfillmentModuleService,
})
