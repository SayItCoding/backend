import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';
import { Mission } from './mission.entity';

@Injectable()
export class MissionService {
  constructor(
    @InjectRepository(Mission)
    private repo: Repository<Mission>,
  ) {}

  paginate(options: IPaginationOptions): Promise<Pagination<Mission>> {
    return paginate(this.repo, options);
  }

  async paginateQB(options: IPaginationOptions): Promise<Pagination<Mission>> {
    const qb = this.repo.createQueryBuilder('u');
    qb.orderBy('u.createdAt', 'DESC');
    return paginate(qb, options);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }
}
