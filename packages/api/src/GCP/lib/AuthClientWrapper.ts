import { GoogleAuthClient } from '@cloud-carbon-footprint/common'
import { JWT } from 'google-auth-library'

interface GetAccessTokenResponse {
  token: string
  res: any
}

export class AuthClientWrapper extends JWT {
  constructor(private authClient: GoogleAuthClient) {
    super()
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    const headers = await this.authClient.getRequestHeaders()
    return headers
  }

  async getAccessToken(): Promise<GetAccessTokenResponse> {
    const headers = await this.authClient.getRequestHeaders()
    const token = headers.Authorization.replace('Bearer ', '')
    return {
      token,
      res: null,
    }
  }

  async getRequestMetadata(url?: string): Promise<Record<string, string>> {
    return this.getRequestHeaders()
  }
} 