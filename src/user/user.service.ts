import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async create(data: {
    email: string;
    name: string;
    password: string;
    roles?: string[];
  }) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async getProfileOrThrow(id: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    // 비밀번호 제거
    const { password, ...safe } = user as any;
    return safe;
  }
}
