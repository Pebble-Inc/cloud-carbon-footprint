import { CCFConfig, configLoader } from '@cloud-carbon-footprint/common'

export const mergeConfig = (ccfConfig: Partial<CCFConfig>) => {
  let _config = configLoader()
  _config = {
    ..._config,
    ...ccfConfig,
    AWS: {
      ..._config.AWS,
      ...ccfConfig.AWS,
      authentication: {
        mode: 'AWS',
        options: {
          targetRoleName: 'ccf-app',
        },
      },
      ...{
        USE_BILLING_DATA: Boolean(ccfConfig.AWS?.BILLING_ACCOUNT_ID),
        INCLUDE_ESTIMATES: Boolean(ccfConfig.AWS?.BILLING_ACCOUNT_ID),
      },
    },
    GCP: {
      ..._config.GCP,
      ...ccfConfig.GCP,
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
  }
  return _config
}
