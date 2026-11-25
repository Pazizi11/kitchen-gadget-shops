import { MedusaService } from "@medusajs/framework/utils"
import CjFulfillmentJob from "./models/fulfillment-job"

class CjFulfillmentModuleService extends MedusaService({
  CjFulfillmentJob,
}) {}

export default CjFulfillmentModuleService
