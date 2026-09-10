import { Module } from '@nestjs/common';
import { GoogleClassroomClient } from './google-classroom.client';

@Module({
  providers: [GoogleClassroomClient],
  exports: [GoogleClassroomClient],
})
export class GoogleClassroomModule {}
