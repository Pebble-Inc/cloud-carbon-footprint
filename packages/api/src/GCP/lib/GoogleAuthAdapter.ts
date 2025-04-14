import { GoogleAuth } from 'google-auth-library'
import http from 'http'

export interface AwsMetadataService {
  getAwsRegion(): Promise<string>
  getAwsRoleName(): Promise<string>
  getAwsCredentials(): Promise<any>
}

export class GoogleAuthAdapter implements AwsMetadataService {
  private awsRegion: string | null = null
  private awsRoleName: string | null = null
  private awsCredentials: any = null
  private imdsv2Token: string | null = null

  constructor(private wrappedAuth: GoogleAuth<any>) {}

  private async getIMDSv2Token(): Promise<string> {
    if (this.imdsv2Token) {
      return this.imdsv2Token
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: '169.254.169.254',
        path: '/latest/api/token',
        method: 'PUT',
        headers: {
          'X-aws-ec2-metadata-token-ttl-seconds': '21600'
        }
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          this.imdsv2Token = data
          resolve(data)
        })
      })

      req.on('error', reject)
      req.end()
    })
  }

  private async httpGet(path: string): Promise<string> {
    const token = await this.getIMDSv2Token()
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '169.254.169.254',
        path: path,
        headers: {
          'X-aws-ec2-metadata-token': token
        }
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => resolve(data))
      })

      req.on('error', reject)
      req.end()
    })
  }

  async getAwsRegion(): Promise<string> {
    if (this.awsRegion) {
      return this.awsRegion
    }

    try {
      this.awsRegion = await this.httpGet('/latest/meta-data/placement/region')
      return this.awsRegion
    } catch (error) {
      throw new Error(`Failed to get AWS region: ${error.message}`)
    }
  }

  async getAwsRoleName(): Promise<string> {
    if (this.awsRoleName) {
      return this.awsRoleName
    }

    try {
      this.awsRoleName = await this.httpGet('/latest/meta-data/iam/security-credentials/')
      return this.awsRoleName
    } catch (error) {
      throw new Error(`Failed to get AWS role name: ${error.message}`)
    }
  }

  async getAwsCredentials(): Promise<any> {
    if (this.awsCredentials) {
      return this.awsCredentials
    }

    try {
      const roleName = await this.getAwsRoleName()
      const credentials = await this.httpGet(`/latest/meta-data/iam/security-credentials/${roleName}`)
      this.awsCredentials = JSON.parse(credentials)
      return this.awsCredentials
    } catch (error) {
      throw new Error(`Failed to get AWS credentials: ${error.message}`)
    }
  }
} 