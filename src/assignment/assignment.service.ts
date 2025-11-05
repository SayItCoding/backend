import { Injectable } from '@nestjs/common';

@Injectable()
export class AssignmentService {
  findAll() {
    return { data: [], message: 'Assignment list' };
  }

  findOne(id: string) {
    return { id, message: 'Assignment detail' };
  }

  create(payload: any) {
    return { id: 'new-id', ...payload, message: 'Assignment created' };
  }
}
