import { Module } from '@nestjs/common';
import { MicrosoftTeamsClient } from './microsoft-teams.client';

@Module({
  providers: [MicrosoftTeamsClient],
  exports: [MicrosoftTeamsClient],
})
export class MicrosoftTeamsModule {}
