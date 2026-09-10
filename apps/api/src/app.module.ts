import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { Tenant } from './tenant/tenant.entity';
import { CryptoModule } from './crypto/crypto.module';
import { ProfessorModule } from './professor/professor.module';
import { Professor } from './professor/professor.entity';
import { ExternalAccount } from './professor/external-account.entity';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 1521),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        serviceName: config.get<string>('DB_SERVICE_NAME'),
        entities: [Tenant, Professor, ExternalAccount],
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    CryptoModule,
    TenantModule,
    ProfessorModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Rotas /auth/* resolvem o tenant pelo state do OAuth (ver auth/oauth-state.ts),
    // não pelo header x-tenant-slug, então ficam fora do middleware global.
    consumer
      .apply(TenantMiddleware)
      .exclude('health', 'auth/(.*)')
      .forRoutes('*');
  }
}
