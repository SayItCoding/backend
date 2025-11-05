import { Injectable } from '@nestjs/common';

@Injectable()
export class MissionService {
  findAll() {
    return { data: [], message: 'Mission list' };
  }

  findOne(id: string) {
    return { id, message: 'Mission detail' };
  }

  create(payload: any) {
    return { id: 'new-id', ...payload, message: 'Mission created' };
  }
}
