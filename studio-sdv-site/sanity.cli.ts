import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'mei3zxrq',
    dataset: 'production',
  },
  // Current hosted studio — change to 'sdv-site' after `sanity undeploy` + redeploy
  studioHost: 'sdv-site',
  deployment: {
    autoUpdates: true,
    appId: 'fkkwl23lu8kw88imz4wbvdj5',
  },
})
