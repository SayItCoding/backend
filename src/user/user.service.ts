import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { UserProfileDto } from './dto/user-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  findById(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  async create(data: {
    email: string;
    name: string;
    password: string;
    roles?: string[];
  }) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async getMe(userId: number): Promise<UserProfileDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const dto: UserProfileDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles ?? null,
      studyStreak: user.studyStreak,
      lastStudyDate: user.lastStudyDate,
      createdAt: user.createdAt,
    };

    return dto;
  }
}
