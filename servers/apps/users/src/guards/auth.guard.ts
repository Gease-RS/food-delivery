import { JwtService } from '@nestjs/jwt'
import { ExecutionContext, Injectable, UnauthorizedException, CanActivate } from "@nestjs/common"
import { PrismaService } from './../../../../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { GqlExecutionContext } from '@nestjs/graphql'

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly JwtService: JwtService,
        private readonly prisma: PrismaService,
        private readonly config: ConfigService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const gqlContext = GqlExecutionContext.create(context)
        const { req } = gqlContext.getContext()

        const accessToken = req.headers.accessToken as string
        const refreshToken = req.headers.refreshToken as string

        if (!accessToken || !refreshToken) {
            throw new UnauthorizedException('Please login to access this resource!')
        }

        if(accessToken) {
            const decoded = this.JwtService.verify(accessToken, {
                secret: this.config.get<string>('ACCESS_TOKEN_SECRET')
            })

            if(!decoded) {
                throw new UnauthorizedException('Invalid access token!')
            }

            await this.updateAccessToken(req)
        }

        return true
    }

    private async updateAccessToken(req: any):Promise<void> {
        try {
            const refreshTokenData = req.headers.refreshToken as string
            const decoded = await this.JwtService.verify(refreshTokenData, {
                secret: this.config.get<string>('REFRESH_TOKEN_SECRET')
            })

            if(!decoded) {
                throw new UnauthorizedException('Invalid refresh token!')
            }

            const user = await this.prisma.user.findUnique({
                where: { id: decoded.id }
            })

            const accessToken = this.JwtService.sign(
                { id: user.id },
                {
                    secret: this.config.get<string>('ACCESS_TOKEN_SECRET'),
                    expiresIn: '15m'
                }
            )

            const refreshToken = this.JwtService.sign(
                { id: user.id },
                { secret: this.config.get<string> ('REFRESH_TOKEN_SECRET'), 
                    expiresIn: '7d'
                } 
            )

            req.accesstoken = accessToken
            req.refreshtoken = refreshToken
            req.user = user

        } catch (error) {
            console.log(error)
        }
    }
}