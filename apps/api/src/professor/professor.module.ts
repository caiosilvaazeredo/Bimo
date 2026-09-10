import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professor } from './professor.entity';
import { ExternalAccount } from './external-account.entity';
import { ProfessorsService } from './professors.service';
import { ExternalAccountsService } from './external-accounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Professor, ExternalAccount])],
  providers: [ProfessorsService, ExternalAccountsService],
  exports: [ProfessorsService, ExternalAccountsService],
})
export class ProfessorModule {}
