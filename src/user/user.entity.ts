import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  email: string;

  @Column({ length: 80 })
  name: string;

  @Column()
  password: string; // 해시 저장

  @Column('simple-array', { nullable: true })
  roles?: string[]; // ['user','admin'] 등

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 12);
  }

  async comparePassword(plain: string) {
    return bcrypt.compare(plain, this.password);
  }
}
