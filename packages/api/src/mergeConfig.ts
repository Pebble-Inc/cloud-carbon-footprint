import { CCFConfig, configLoader } from '@cloud-carbon-footprint/common'
import dotenv from 'dotenv'
dotenv.config()

export const mergeConfig = (ccfConfig: Partial<CCFConfig>) => {
  let _config = configLoader()
  _config = {
    ..._config,
    ...ccfConfig,
    AWS: {
      ..._config.AWS,
      ...ccfConfig.AWS,
      ...(Boolean(ccfConfig.AWS?.BILLING_ACCOUNT_ID)
        ? {
            authentication: {
              mode: 'AWS',
              options: {
                targetRoleName: process.env.CCF_ROLE,
              },
            },
          }
        : {}),
      ...{
        USE_BILLING_DATA: Boolean(ccfConfig.AWS?.BILLING_ACCOUNT_ID),
        INCLUDE_ESTIMATES: Boolean(ccfConfig.AWS?.BILLING_ACCOUNT_ID),
      },
    },
    GCP: {
      ..._config.GCP,
      ...ccfConfig.GCP,
      ...{
        USE_BILLING_DATA: Boolean(ccfConfig.GCP?.BILLING_PROJECT_ID),
      },
    },
    AZURE: {
      ..._config.AZURE,
      ...ccfConfig.AZURE,
      ...{
        USE_BILLING_DATA: Boolean(ccfConfig.AZURE?.authentication?.clientId),
      },
    },
    ALI: {
      ..._config.ALI,
      ...ccfConfig.ALI,
    },
    ON_PREMISE: {
      ..._config.ON_PREMISE,
      ...ccfConfig.ON_PREMISE,
    },
  }
  return _config
}
