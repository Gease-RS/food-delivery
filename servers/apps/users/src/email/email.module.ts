import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { EjsAdapter } from "@nestjs-modules/mailer/dist/adapters/ejs.adapter"

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST'),
          secure: true,
          auth: {
            user: config.get<string>('SMTP_MAIL'),
            pass: config.get<string>('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: 'Becodemy',
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new EjsAdapter(),
          options: {
            strict: false,
          },
        }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [EmailService]
})
export class EmailModule {}
