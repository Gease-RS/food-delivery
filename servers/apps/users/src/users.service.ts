import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt'
import { ActivationDto, LoginDto, RegisterDto } from './dto/user.dto'
import { PrismaService } from './../../../prisma/prisma.service'
import { Response } from 'express'
import * as bcrypt from 'bcrypt'
import { EmailService } from './email/email.service'
import { TokenSender } from './utils/sendToken'

interface UserData {
  name: string
  email: string
  password: string
  phone_number: string
}

@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService
  ) {}

  async register(registerDto: RegisterDto, response: Response) {
    const { name, email, password, phone_number} = registerDto

    const isEmailExist = await this.prisma.user.findUnique({
      where: {
        email
      },
    });
    if (isEmailExist) {
      throw new BadRequestException('User already exist with this email!')
    }


    const hashedPassword = await bcrypt.hash(password, 10)

    const user = {
        name,
        email,
        password: hashedPassword,
        phone_number
      }

      const activationToken = await this.createActivationToken(user)

      const activationCode = activationToken.activationCode

      const activation_token = activationToken.token

      await this.emailService.sendMail({
        email,
        subject: 'Activate your account',
        template: './activation-mail',
        name,
        activationCode
      })

    return { activation_token, response }
  }

  async createActivationToken(user: UserData) {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString()

    const token = this.jwtService.sign(
      {
        user,
        activationCode
      },
      {
        secret: this.configService.get<string>('ACTIVATION_SECRET'),
        expiresIn: '5m'
      }
    )
    return { token, activationCode }
  }

  async Login(loginDto: LoginDto) {
    const { email, password } = loginDto
    const user = await this.prisma.user.findUnique({
      where: {
        email
      },
    });

    if (user && (await this.comparePassword(password, user.password))) {
      const tokenSender = new TokenSender(this.configService, this.jwtService)
      return tokenSender.sendToken(user)
    } else {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        error: {
          message: 'Invalid email or password'
        },
      };
    }
  }

  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  async getLoggedInUser(req: any) {
    const user = req.user

    const accessToken = req.accessoken
    const refreshToken = req.refreshToken

    console.log({ user, accessToken, refreshToken})
  }
  
  async activateUser(activationDto:ActivationDto, response: Response) {
    const { activationToken, activationCode } = activationDto

    const newUser: { user: UserData, activationCode: string} = 
    this.jwtService.verify(activationToken, { 
        secret: this.configService.get<string>('ACTIVATION_SECRET')
      } as JwtVerifyOptions) as { user: UserData, activationCode: string}

    if (newUser.activationCode !== activationCode) {
      throw new BadRequestException('Invalid activation code')
    }

    const { name, email, password, phone_number } = newUser.user

    const existUser = await this.prisma.user.findUnique({
      where: {
        email
      }
    })

    if (existUser) {
      throw new BadRequestException('User already exist with this email')
    }

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password,
        phone_number
      }
     })

     return { user, response }
  }

  async Logout(req: any) {
    req.user = null;
    req.refreshtoken = null;
    req.accesstoken = null;
    return { message: 'Logged out successfully!' };
  }

  async getUsers() {
    return this.prisma.user.findMany({})
  }
}
